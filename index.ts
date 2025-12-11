#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./src/tools/index.js";
import { startWebUIServer } from "./src/webui/server.js";

// Start WebUI Server (runs on port 3456 by default)
const webuiPort = parseInt(process.env.WEBUI_PORT || "3456");
startWebUIServer(webuiPort);

// Server Setup
const server = new McpServer({
    name: "git-conflict-manager",
    version: "1.0.0",
},
    { capabilities: { tools: {} } });

// Register Tools
registerTools(server);

// Start MCP server (stdio)
const transport = new StdioServerTransport();
await server.connect(transport);