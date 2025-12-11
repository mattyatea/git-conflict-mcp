#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./src/tools/index.js";
import { startWebUIServer } from "./src/webui/server.js";

// Start WebUI Server (runs on port 3456 by default)
const webuiPort = parseInt(process.env.WEBUI_PORT || "3456");
const webuiServer = startWebUIServer(webuiPort);

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

// Graceful shutdown handler
async function shutdown(signal: string) {
    console.error(`\n🛑 Received ${signal}, shutting down gracefully...`);

    // Close WebUI server
    webuiServer.close(() => {
        console.error("   WebUI server closed");
    });

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

// Handle process exit
process.on("exit", () => {
    webuiServer.close();
});