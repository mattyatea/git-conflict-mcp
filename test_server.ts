import { spawn } from "bun";
import * as fs from "fs/promises";
import * as path from "path";

const TEST_REPO = path.resolve("test_repo");

async function setupRepo() {
    await fs.rm(TEST_REPO, { recursive: true, force: true });
    await fs.mkdir(TEST_REPO);

    const run = async (cmd: string[]) => {
        const proc = spawn(cmd, { cwd: TEST_REPO });
        await proc.exited;
    };

    await run(["git", "init"]);
    await run(["git", "branch", "-m", "main"]);
    await run(["git", "config", "user.email", "you@example.com"]);
    await run(["git", "config", "user.name", "Your Name"]);
    await fs.writeFile(path.join(TEST_REPO, "conflict.txt"), "Base content\n");
    await run(["git", "add", "."]);
    await run(["git", "commit", "-m", "Initial"]);

    await run(["git", "checkout", "-b", "feature"]);
    await fs.writeFile(path.join(TEST_REPO, "conflict.txt"), "Feature content\n");
    await run(["git", "commit", "-am", "Feature change"]);

    await run(["git", "checkout", "main"]);
    await fs.writeFile(path.join(TEST_REPO, "conflict.txt"), "Main content\n");
    await run(["git", "commit", "-am", "Main change"]);

    // This will fail with conflict
    // We ignore the exit code because merge failure is expected
    const proc = spawn(["git", "merge", "feature"], { cwd: TEST_REPO });
    await proc.exited;
}

async function testServer() {
    try {
        await setupRepo();
        console.log("Repo setup complete.");

        const serverProc = spawn(["./git-conflict-mcp"], {
            cwd: process.cwd(),
            stdin: "pipe",
            stdout: "pipe",
        });

        const reader = serverProc.stdout.getReader();
        const writer = serverProc.stdin;

        async function send(msg: any) {
            const str = JSON.stringify(msg) + "\n";
            writer.write(new TextEncoder().encode(str));
            await writer.flush();
        }

        // Read loop
        let buffer = "";
        async function readMessage() {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += new TextDecoder().decode(value);
                // Check for newline
                const newlineIndex = buffer.indexOf("\n");
                if (newlineIndex !== -1) {
                    const line = buffer.slice(0, newlineIndex);
                    buffer = buffer.slice(newlineIndex + 1);
                    if (line.trim()) return JSON.parse(line);
                }
            }
        }

        // Initialize
        await send({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
                protocolVersion: "2024-11-05",
                capabilities: {},
                clientInfo: { name: "test", version: "1.0" }
            }
        });

        let msg = await readMessage();
        console.log("Init response:", JSON.stringify(msg, null, 2));

        await send({
            jsonrpc: "2.0",
            method: "notifications/initialized"
        });

        // Init project
        await send({
            jsonrpc: "2.0",
            id: 2,
            method: "tools/call",
            params: {
                name: "init_project",
                arguments: { path: TEST_REPO }
            }
        });
        msg = await readMessage();
        console.log("Init project response:", JSON.stringify(msg, null, 2));

        // List conflicts
        await send({
            jsonrpc: "2.0",
            id: 3,
            method: "tools/call",
            params: {
                name: "list_conflicts",
                arguments: {}
            }
        });
        msg = await readMessage();
        console.log("List conflicts response:", JSON.stringify(msg, null, 2));

        // Read conflict
        await send({
            jsonrpc: "2.0",
            id: 4,
            method: "tools/call",
            params: {
                name: "read_conflict",
                arguments: { id: "1" }
            }
        });
        msg = await readMessage();
        console.log("Read conflict response:", JSON.stringify(msg, null, 2));

        // Resolve conflict
        await send({
            jsonrpc: "2.0",
            id: 5,
            method: "tools/call",
            params: {
                name: "resolve_conflict",
                arguments: { id: "1" }
            }
        });
        msg = await readMessage();
        console.log("Resolve conflict response:", JSON.stringify(msg, null, 2));

        // List conflicts again (should be empty)
        await send({
            jsonrpc: "2.0",
            id: 6,
            method: "tools/call",
            params: {
                name: "list_conflicts",
                arguments: {}
            }
        });
        msg = await readMessage();
        console.log("List conflicts response (after resolve):", JSON.stringify(msg, null, 2));

        serverProc.kill();
    } catch (e) {
        console.error(e);
    }
}

testServer();
