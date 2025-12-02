import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerInitProject } from "./initProject.js";
import { registerListConflicts } from "./listConflicts.js";
import { registerReadConflict } from "./readConflict.js";
import { registerResolveConflict } from "./resolveConflict.js";

export function registerTools(server: McpServer) {
    registerInitProject(server);
    registerListConflicts(server);
    registerReadConflict(server);
    registerResolveConflict(server);
}
