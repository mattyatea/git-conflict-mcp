import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerInitProject } from "./initProject.js";
import { registerListConflicts } from "./listConflicts.js";
import { registerReadConflict } from "./readConflict.js";
import { registerResolveConflict } from "./resolveConflict.js";
import { registerPostResolve } from "./postResolve.js";
import { registerListPendingResolves } from "./listPendingResolves.js";
import { registerReadPendingResolve } from "./readPendingResolve.js";
import { registerResolvePendingResolve } from "./resolvePendingResolve.js";

export function registerTools(server: McpServer, isReviewMode: boolean = false) {
    registerInitProject(server);
    if (isReviewMode) {
        registerListPendingResolves(server);
        registerReadPendingResolve(server);
        registerResolvePendingResolve(server);
    } else {
        registerListConflicts(server);
        registerReadConflict(server);
        registerPostResolve(server);
        registerResolveConflict(server);
    }
}
