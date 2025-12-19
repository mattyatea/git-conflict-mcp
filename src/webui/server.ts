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
let isReviewMode = false;

export function getReviewMode() {
    return isReviewMode;
}



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
    let items: PendingResolve[] = [];
    if (externalWebUIUrl) {
        try {
            const res = await fetch(`${externalWebUIUrl}/api/pending`);
            if (!res.ok) throw new Error(`External WebUI returned ${res.status}`);
            items = await res.json() as PendingResolve[];
        } catch (e) {
            console.error("Failed to fetch from external WebUI:", e);
            items = [];
        }
    } else {
        items = Array.from(pendingResolves.values());
    }

    // Filter out items that haven't been properly reviewed
    // We hide items with no reason or generic "resolve"/"resolved" reasons
    return items.filter(item =>
        item.reason &&
        item.reason.trim().length > 0 &&
        !['resolve', 'resolved'].includes(item.reason.trim().toLowerCase())
    );
}

import { generateId } from "../lib/id.js";

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

// Add a pending resolve request
export async function addPendingResolve(data: {
    filePath: string;
    absolutePath: string;
    projectPath: string;
    type: "resolve" | "delete" | "add";
    reason?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
    if (externalWebUIUrl) {
        try {
            const res = await fetch(`${externalWebUIUrl}/api/add`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error(`External WebUI returned ${res.status}`);
            return await res.json() as any;
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    // Local
    try {
        const id = generateId(data.filePath); // Use consistent ID

        // Check if already exists?
        // If we want to overwrite, we can just set it.
        // It provides deduplication automatically.

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
        return { success: true, id };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// Approve a pending resolve
export async function approvePendingResolve(id: string, comment?: string): Promise<{ success: boolean; message?: string; error?: string }> {
    if (externalWebUIUrl) {
        try {
            const res = await fetch(`${externalWebUIUrl}/api/approve/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ comment })
            });
            return await res.json() as any;
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    const pending = pendingResolves.get(id);
    if (!pending) {
        return { success: false, error: "Not found" };
    }

    try {
        if (comment) {
            console.error(`[Resolution Comment for ${pending.filePath}]: ${comment}`);
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
        return { success: true, message };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// Reject a pending resolve
export async function rejectPendingResolve(id: string, comment?: string): Promise<{ success: boolean; error?: string }> {
    if (externalWebUIUrl) {
        try {
            const res = await fetch(`${externalWebUIUrl}/api/reject/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ comment })
            });
            return await res.json() as any;
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    const pending = pendingResolves.get(id);
    if (!pendingResolves.has(id)) {
        return { success: false, error: "Not found" };
    }

    try {
        if (comment && pending) {
            console.error(`[Rejection Comment for ${pending.filePath}]: ${comment}`);
            state.addRejection(pending.filePath, comment);

            if (conflictLogger) {
                conflictLogger(`REJECTED: ${pending.filePath}. Reason: ${comment}`);
            }
        }

        pendingResolves.delete(id);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
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

    // Disable caching for all requests to prevent stale content
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");

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

    if (pathname === "/api/config" && method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ reviewMode: isReviewMode }));
        return;
    }

    if (pathname === "/api/pending" && method === "GET") {
        try {
            const pending = await getPendingResolves();
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(pending));
        } catch (e: any) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    if (pathname === "/api/add" && method === "POST") {
        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", async () => {
            try {
                const data = JSON.parse(body);
                const result = await addPendingResolve(data);

                if (result.success) {
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify(result));
                } else {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify(result));
                }
            } catch (e: any) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }

    if (pathname.startsWith("/api/approve/") && method === "POST") {
        const id = pathname.replace("/api/approve/", "");
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
                        // Ignore
                    }
                }
                const result = await approvePendingResolve(id, comment);
                if (result.success) {
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify(result));
                } else {
                    res.writeHead(result.error === "Not found" ? 404 : 500, { "Content-Type": "application/json" });
                    res.end(JSON.stringify(result));
                }
            } catch (e: any) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }

    if (pathname.startsWith("/api/reject/") && method === "POST") {
        const id = pathname.replace("/api/reject/", "");
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
                        // Ignore
                    }
                }
                const result = await rejectPendingResolve(id, comment);
                if (result.success) {
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify(result));
                } else {
                    res.writeHead(result.error === "Not found" ? 404 : 500, { "Content-Type": "application/json" });
                    res.end(JSON.stringify(result));
                }
            } catch (e: any) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }

    if (pathname.startsWith("/api/save/") && method === "POST") {
        const id = pathname.replace("/api/save/", "");

        if (externalWebUIUrl) {
            // Proxy to external WebUI
            let body = "";
            req.on("data", chunk => body += chunk);
            req.on("end", async () => {
                try {
                    const resExt = await fetch(`${externalWebUIUrl}${pathname}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: body
                    });
                    const data = await resExt.json() as any;
                    res.writeHead(resExt.status, { "Content-Type": "application/json" });
                    res.end(JSON.stringify(data));
                } catch (e: any) {
                    res.writeHead(500, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ success: false, error: e.message }));
                }
            });
            return;
        }

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
// Start server function (exported for use in main index.ts)
export function startWebUIServer(port: number = PORT, reviewMode: boolean = false): http.Server {
    isReviewMode = reviewMode;
    const server = http.createServer(handleRequest);

    server.listen(port, "127.0.0.1", () => {
        console.error(`🔀 Git Conflict Resolution WebUI`);
        if (isReviewMode) {
            console.error(`   Mode: REVIEW MODE (--review)`);
        }
        console.error(`   Running at: http://localhost:${port}`);
    });

    return server;
}

// Direct execution (when run as standalone)
const isDirectExecution = process.argv[1]?.includes("webui/server");
if (isDirectExecution) {
    startWebUIServer();
}
