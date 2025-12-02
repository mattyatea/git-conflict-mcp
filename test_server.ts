import { spawn } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_REPO = path.resolve("test_repo");

async function setupRepo() {
    await fs.rm(TEST_REPO, { recursive: true, force: true });
    await fs.mkdir(TEST_REPO);

    const run = (cmd: string[]) => {
        return new Promise<void>((resolve, reject) => {
            if (cmd.length === 0) return resolve();
            const command = cmd[0] as string;
            const args = cmd.slice(1);
            const proc = spawn(command, args, { cwd: TEST_REPO, stdio: 'ignore' });
            proc.on('close', (code: number | null) => {
                if (code === 0 || (cmd.includes("merge") && code !== 0)) { // Allow merge failure
                    resolve();
                } else {
                    reject(new Error(`Command failed: ${cmd.join(' ')}`));
                }
            });
            proc.on('error', reject);
        });
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
    await run(["git", "merge", "feature"]);
}

async function testServer() {
    try {
        await setupRepo();
        console.log("Repo setup complete.");

        // Run the compiled JS file
        const serverPath = path.resolve(process.cwd(), "dist/index.js");
        const serverProc = spawn("node", [serverPath], {
            cwd: process.cwd(),
            stdio: ['pipe', 'pipe', 'inherit']
        });

        const reader = serverProc.stdout;
        const writer = serverProc.stdin;

        async function send(msg: any) {
            const str = JSON.stringify(msg) + "\n";
            writer.write(str);
        }

        // Read loop
        let buffer = "";

        // Helper to read next JSON message
        function readMessage(): Promise<any> {
            return new Promise((resolve, reject) => {
                const checkBuffer = () => {
                    const newlineIndex = buffer.indexOf("\n");
                    if (newlineIndex !== -1) {
                        const line = buffer.slice(0, newlineIndex);
                        buffer = buffer.slice(newlineIndex + 1);
                        if (line.trim()) {
                            try {
                                resolve(JSON.parse(line));
                            } catch (e) {
                                reject(e);
                            }
                        } else {
                            checkBuffer(); // Skip empty lines
                        }
                    } else {
                        // Wait for more data
                        reader.once('data', onData);
                    }
                };

                const onData = (chunk: Buffer) => {
                    buffer += chunk.toString();
                    checkBuffer();
                };

                if (buffer.indexOf("\n") !== -1) {
                    checkBuffer();
                } else {
                    reader.once('data', onData);
                }

                serverProc.on('error', reject);
                serverProc.on('close', () => reject(new Error("Server closed")));
            });
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
        process.exit(1);
    }
}

testServer();
