#!/usr/bin/env node
import * as http from "http";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { promisify } from "util";
import * as mime from "mime-types";
import { state } from "../lib/state.js";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.WEBUI_PORT || "3456");

// Define where the static files are located
// dist/src/webui/server.js -> ../../webui/
// Adjusted relative path based on build output structure:
// Source: src/webui/server.ts
// Compiled: dist/src/webui/server.js
// Static files: dist/webui/
const WEBUI_IDENTIFIER = "git-conflict-webui-v1";
export { WEBUI_IDENTIFIER };
const STATIC_ROOT = path.resolve(__dirname, '../../../dist/webui');

export interface PendingResolve {
    id: string;
    filePath: string;         // Relative path
    absolutePath: string;     // Absolute path
    projectPath: string;
    type: "resolve" | "delete" | "add";
    reason?: string;          // Reason for resolution
    fileContent?: string;     // Current file content (if exists)
    gitDiff?: string;         // Git diff output
    timestamp: number;
}

// In-memory pending resolves
const pendingResolves: Map<string, PendingResolve> = new Map();
let externalWebUIUrl: string | null = null;
let conflictLogger: ((message: string) => void) | null = null;

const STATE_FILE = path.join(process.cwd(), '.git-conflict-mcp-state.json');

// Load state from disk
async function loadState() {
    try {
        const content = await fs.readFile(STATE_FILE, 'utf-8');
        const items = JSON.parse(content) as PendingResolve[];
        items.forEach(item => pendingResolves.set(item.id, item));
        console.error(`[WebUI] Loaded ${items.length} pending resolves from state`);
    } catch (e: any) {
        if (e.code !== 'ENOENT') {
            console.error('[WebUI] Failed to load state:', e.message);
        }
    }
}

// Save state to disk
async function saveState() {
    try {
        const items = Array.from(pendingResolves.values());
        await fs.writeFile(STATE_FILE, JSON.stringify(items, null, 2), 'utf-8');
    } catch (e: any) {
        console.error('[WebUI] Failed to save state:', e.message);
    }
}

// Initial load
loadState();

// Configure to use external WebUI
export function setUseExternalWebUI(url: string) {
    externalWebUIUrl = url;
}

// Set logger for conflict resolution comments
export function setConflictLogger(logger: (message: string) => void) {
    conflictLogger = logger;
}


// Get all pending resolves (local or external)
export async function getPendingResolves(): Promise<PendingResolve[]> {
    if (externalWebUIUrl) {
        try {
            const res = await fetch(`${externalWebUIUrl}/api/pending`);
            if (!res.ok) throw new Error(`External WebUI returned ${res.status}`);
            return await res.json() as PendingResolve[];
        } catch (e) {
            console.error("Failed to fetch from external WebUI:", e);
            return [];
        }
    }
    return Array.from(pendingResolves.values());
}

// Generate unique ID
function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Run git command
async function runGit(args: string[], cwd: string): Promise<string> {
    try {
        const { stdout } = await execFileAsync("git", args, { cwd });
        return stdout;
    } catch (error: any) {
        throw new Error(`Git command failed: ${error.stderr || error.message}`);
    }
}

// Get file content with conflict markers
async function getFileContent(absolutePath: string): Promise<string | undefined> {
    try {
        return await fs.readFile(absolutePath, "utf-8");
    } catch {
        return undefined;
    }
}

// Get git diff for the file
async function getGitDiff(filePath: string, projectPath: string): Promise<string> {
    try {
        return await runGit(["diff", filePath], projectPath);
    } catch {
        return "";
    }
}

// Serve static files
async function serveStatic(req: http.IncomingMessage, res: http.ServerResponse, filePath: string) {
    try {
        // Prevent directory traversal
        const resolvedPath = path.resolve(STATIC_ROOT, filePath.replace(/^\/+/, ''));
        if (!resolvedPath.startsWith(STATIC_ROOT)) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }

        const stats = await fs.stat(resolvedPath);
        if (stats.isDirectory()) {
            // Try to serve index.html for directories
            return serveStatic(req, res, path.join(filePath, 'index.html'));
        }

        const content = await fs.readFile(resolvedPath);
        const contentType = mime.lookup(resolvedPath) || 'application/octet-stream';

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    } catch (e) {
        // If file not found, serve index.html for client-side routing (fallback)
        // But only for HTML-like requests, not assets
        if (filePath.indexOf('.') === -1 || filePath.endsWith('.html')) {
            try {
                const indexContent = await fs.readFile(path.join(STATIC_ROOT, 'index.html'));
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(indexContent);
            } catch {
                res.writeHead(404);
                res.end('Not Found');
            }
        } else {
            res.writeHead(404);
            res.end('Not Found');
        }
    }
}

// Request handlers
async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url || "/", `http://localhost:${PORT}`);
    const pathname = url.pathname;
    const method = req.method || "GET";

    // CORS headers for localhost
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }


    // API Routes
    if (pathname === "/api/health" && method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", identifier: WEBUI_IDENTIFIER }));
        return;
    }

    if (pathname === "/api/pending" && method === "GET") {
        const pending = Array.from(pendingResolves.values());
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(pending));
        return;
    }

    if (pathname === "/api/add" && method === "POST") {
        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", async () => {
            try {
                const data = JSON.parse(body);
                const id = generateId();

                const fileContent = await getFileContent(data.absolutePath);
                const gitDiff = await getGitDiff(data.filePath, data.projectPath);

                const pending: PendingResolve = {
                    id,
                    filePath: data.filePath,
                    absolutePath: data.absolutePath,
                    projectPath: data.projectPath,
                    type: data.type || "resolve",
                    reason: data.reason,
                    fileContent,
                    gitDiff,
                    timestamp: Date.now(),
                };

                pendingResolves.set(id, pending);
                await saveState();

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: true, id }));
            } catch (e: any) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }

    if (pathname.startsWith("/api/approve/") && method === "POST") {
        const id = pathname.replace("/api/approve/", "");
        const pending = pendingResolves.get(id);

        if (!pending) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: "Not found" }));
            return;
        }

        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", async () => {
            try {
                let comment = "";
                if (body) {
                    try {
                        const data = JSON.parse(body);
                        comment = data.comment || "";
                    } catch (e) {
                        // Ignore JSON parse error if body is empty or invalid, just proceed without comment
                    }
                }

                if (comment) {
                    console.log(`[Resolution Comment for ${pending.filePath}]: ${comment}`);
                    if (conflictLogger) {
                        conflictLogger(comment);
                    }
                }

                let message: string;
                switch (pending.type) {
                    case "delete":
                        await runGit(["rm", pending.filePath], pending.projectPath);
                        message = `Deleted (git rm) ${pending.filePath}`;
                        break;
                    case "add":
                    case "resolve":
                    default:
                        await runGit(["add", pending.filePath], pending.projectPath);
                        message = `Resolved (git add) ${pending.filePath}`;
                        break;
                }

                pendingResolves.delete(id);
                await saveState();

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: true, message }));
            } catch (e: any) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }

    if (pathname.startsWith("/api/reject/") && method === "POST") {
        const id = pathname.replace("/api/reject/", "");
        const pending = pendingResolves.get(id);

        if (!pendingResolves.has(id)) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: "Not found" }));
            return;
        }

        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", async () => {
            try {
                let comment = "";
                if (body) {
                    try {
                        const data = JSON.parse(body);
                        comment = data.comment || "";
                    } catch (e) {
                        // Ignore JSON parse error
                    }
                }

                if (comment && pending) {
                    console.log(`[Rejection Comment for ${pending.filePath}]: ${comment}`);
                    state.addRejection(pending.filePath, comment);

                    if (conflictLogger) {
                        conflictLogger(`REJECTED: ${pending.filePath}. Reason: ${comment}`);
                    }
                }

                pendingResolves.delete(id);
                await saveState();

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: true }));
            } catch (e: any) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }

    if (pathname.startsWith("/api/save/") && method === "POST") {
        const id = pathname.replace("/api/save/", "");
        const pending = pendingResolves.get(id);

        if (!pending) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: "Not found" }));
            return;
        }

        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", async () => {
            try {
                const data = JSON.parse(body);
                if (typeof data.content !== 'string') {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ success: false, error: "Invalid content" }));
                    return;
                }

                // Update in-memory
                pending.fileContent = data.content;

                // Write to disk
                await fs.writeFile(pending.absolutePath, data.content, "utf-8");

                // Update git diff because content changed
                pending.gitDiff = await getGitDiff(pending.filePath, pending.projectPath);
                await saveState();

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: true }));
            } catch (e: any) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }

    // Static file serving logic for non-API routes
    if (!pathname.startsWith("/api/")) {
        // Resolve path logic is handled inside serveStatic
        // Note: pathname includes leading slash
        await serveStatic(req, res, pathname);
        return;
    }

    // 404
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
}

// Start server function (exported for use in main index.ts)
export function startWebUIServer(port: number = PORT): http.Server {
    const server = http.createServer(handleRequest);

    server.listen(port, "127.0.0.1", () => {
        console.error(`🔀 Git Conflict Resolution WebUI`);
        console.error(`   Running at: http://localhost:${port}`);
    });

    return server;
}

// Direct execution (when run as standalone)
const isDirectExecution = process.argv[1]?.includes("webui/server");
if (isDirectExecution) {
    startWebUIServer();
}
