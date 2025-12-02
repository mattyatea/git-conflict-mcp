import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getConflictedFiles, runGit } from "../lib/git.js";
import { state } from "../lib/state.js";

export function registerResolveConflict(server: McpServer) {
    server.registerTool(
        "resolve_conflict",
        {
            description: "Mark a conflict as resolved (git add) by its ID.",
            inputSchema: z.object({
                id: z.string().describe("The ID of the file to resolve (from list_conflicts)."),
            }),
        },
        async ({ id }) => {
            const projectPath = state.getProjectPath();
            if (!projectPath) return { content: [{ type: "text", text: "Project not initialized." }], isError: true };
            try {
                const files = await getConflictedFiles();
                const index = parseInt(id) - 1;
                if (index < 0 || index >= files.length) {
                    return { content: [{ type: "text", text: "Invalid ID." }], isError: true };
                }
                const file = files[index];
                if (!file) {
                    return { content: [{ type: "text", text: "Invalid ID (file not found)." }], isError: true };
                }
                await runGit(["add", file]);
                return { content: [{ type: "text", text: `Resolved (git add) ${file}` }] };
            } catch (e: any) {
                return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
            }
        }
    );
}
