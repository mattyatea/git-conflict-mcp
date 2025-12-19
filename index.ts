#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./src/tools/index.js";
import { startWebUIServer, setUseExternalWebUI, WEBUI_IDENTIFIER, setConflictLogger } from "./src/webui/server.js";
import { Server } from "http";

// Parse command line arguments
const args = process.argv.slice(2);
const reviewMode = args.includes('--review');
const portArgIndex = args.indexOf('--port');
let explicitPort: number | null = null;
if (portArgIndex !== -1 && args[portArgIndex + 1]) {
    explicitPort = parseInt(args[portArgIndex + 1] || "3456", 10);
}

// Start WebUI Server (runs on port 3456 by default, or 6543 for review mode)
const defaultPort = reviewMode ? 6543 : 3456;
const webuiPort = explicitPort || parseInt(process.env.WEBUI_PORT as string || defaultPort.toString());
let webuiServer: Server | null = null;

if (reviewMode) {
    // In review mode, we assume the main instance is running on the default port (3456)
    // or we could add another arg for upstream port, but for now assuming 3456.
    // We connect to it to fetch pending resolves.
    const upstreamPort = 3456;
    if (webuiPort !== upstreamPort) {
        setUseExternalWebUI(`http://localhost:${upstreamPort}`);
        console.error(`Review Mode: Connected to upstream WebUI at http://localhost:${upstreamPort}`);
    } else {
        console.warn(`Warning: Review mode port is same as upstream default (${upstreamPort}). Make sure upstream is on a different port.`);
    }
}

try {
    const res = await fetch(`http://127.0.0.1:${webuiPort}/api/health`);
    // If we get a response, the port is in use
    const data = await res.json().catch(() => ({})) as any;

    if (res.ok && data.identifier === WEBUI_IDENTIFIER) {
        if (!reviewMode) {
            console.error(`Using existing WebUI at http://localhost:${webuiPort}`);
            setUseExternalWebUI(`http://localhost:${webuiPort}`);
        } else {
            console.error(`Error: Port ${webuiPort} is already in use.`);
        }
    } else {
        console.error(`Error: Port ${webuiPort} is already in use by another application. WebUI features might be unavailable.`);
        // Do not exit, allow MCP server to run even if WebUI fails to start.
    }
} catch (e: any) {
    if (e?.cause?.code === 'ECONNREFUSED') {
        // Port is free, start our own server
        webuiServer = startWebUIServer(webuiPort, reviewMode);
    } else {
        console.error(`Error checking WebUI port: ${e.message}. WebUI features might be unavailable.`);
        // Do not exit
    }
}

// Server Setup
const mcpServer = new McpServer({
    name: "git-conflict-manager",
    version: "1.0.0",
},
    { capabilities: { tools: {} } });

// Register Tools
registerTools(mcpServer);

// Start MCP server (stdio)
const transport = new StdioServerTransport();
await mcpServer.connect(transport);

// Set up logger to send comments to MCP client
setConflictLogger((message) => {
    try {
        // Accessing underlying server instance to send log message
        const serverInstance = (mcpServer as any).server;
        if (serverInstance && typeof serverInstance.sendLoggingMessage === 'function') {
            serverInstance.sendLoggingMessage({
                level: "notice", // Using 'notice' to ensure visibility
                data: message
            });
        } else {
            // Fallback
            console.error(`[MCP Log] ${message}`);
        }
    } catch (e) {
        console.error(`Failed to send MCP log: ${message}`);
    }
});

// Graceful shutdown handler
async function shutdown(signal: string) {
    console.error(`\n🛑 Received ${signal}, shutting down gracefully...`);

    // Close WebUI server if we started it
    if (webuiServer) {
        webuiServer.close(() => {
            console.error("   WebUI server closed");
        });
    }

    // Close MCP server connection
    try {
        await mcpServer.close();
        console.error("   MCP server closed");
    } catch (e) {
        // Ignore errors during shutdown
    }

    process.exit(0);
}

// Register signal handlers
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Handle stdin close (MCP client disconnected)
process.stdin.on("close", () => shutdown("stdin close"));
process.stdin.on("end", () => shutdown("stdin end"));

// Handle process exit
process.on("exit", () => {
    if (webuiServer) {
        webuiServer.close();
    }
});