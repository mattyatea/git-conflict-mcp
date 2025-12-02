import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./src/tools/index.js";

// Server Setup
const server = new McpServer({
    name: "git-conflict-manager",
    version: "1.0.0",
});

// Register Tools
registerTools(server);

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);