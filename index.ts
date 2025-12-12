#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./src/tools/index.js";
import { startWebUIServer, setUseExternalWebUI, WEBUI_IDENTIFIER, setConflictLogger } from "./src/webui/server.js";
import { Server } from "http";

// Start WebUI Server (runs on port 3456 by default)
const webuiPort = parseInt(process.env.WEBUI_PORT || "3456");
let webuiServer: Server | null = null;

try {
    const res = await fetch(`http://127.0.0.1:${webuiPort}/api/health`);
    // If we get a response, the port is in use
    const data = await res.json().catch(() => ({})) as any;

    if (res.ok && data.identifier === WEBUI_IDENTIFIER) {
        console.error(`Using existing WebUI at http://localhost:${webuiPort}`);
        setUseExternalWebUI(`http://localhost:${webuiPort}`);
    } else {
        console.error(`Error: Port ${webuiPort} is already in use by another application. WebUI features might be unavailable.`);
        // Do not exit, allow MCP server to run even if WebUI fails to start.
    }
} catch (e: any) {
    if (e?.cause?.code === 'ECONNREFUSED') {
        // Port is free, start our own server
        webuiServer = startWebUIServer(webuiPort);
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