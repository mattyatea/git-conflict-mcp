import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerConflictListResource } from "./conflictList.js";

export function registerResources(server: McpServer) {
    registerConflictListResource(server);
}
