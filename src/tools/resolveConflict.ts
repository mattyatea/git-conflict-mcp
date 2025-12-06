import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as nodePath from "path";
import { getConflictedFiles, runGit } from "../lib/git.js";
import { state } from "../lib/state.js";
import { rateLimiter } from "../lib/rateLimit.js";

const resolutionTypeSchema = z.enum(["resolve", "delete", "add"]).describe(
    "Resolution type:\n" +
    "- 'resolve': Normal resolution (edit content and git add)\n" +
    "- 'delete': Delete the file (git rm)\n" +
    "- 'add': Add the file as-is (git add, for new file conflicts)"
);

export function registerResolveConflict(server: McpServer) {
    server.registerTool(
        "resolve_conflict",
        {
            description: "Mark a conflict as resolved by its ID or file path. Supports different resolution types for various conflict scenarios (content conflicts, delete/modify conflicts, etc.). You must run post_resolve before running this.",
            inputSchema: z.object({
                id: z.string().optional().describe("The ID of the file to resolve (from list_conflicts)."),
                path: z.string().optional().describe("The file path to resolve."),
                type: resolutionTypeSchema.optional().describe("Resolution type. Default is 'resolve'."),
                force: z.boolean().optional().describe("Force resolution, bypassing the safety check."),
            }),
        },
        async ({ id, path, type, force }) => {
            if (!id && !path) {
                return { content: [{ type: "text", text: "Either id or path must be provided." }], isError: true };
            }
            if (!force && !rateLimiter.check("resolve_conflict", 3, 60 * 1000)) {
                return { content: [{ type: "text", text: "Are you sure you have resolved the conflict correctly? Please check again." }], isError: true };
            }

            const resolutionType = type || "resolve";
            const projectPath = state.getProjectPath();
            if (!projectPath) return { content: [{ type: "text", text: "Project not initialized." }], isError: true };

            try {
                const files = await getConflictedFiles();
                let fileToResolve: string | undefined;

                if (id) {
                    const index = parseInt(id) - 1;
                    if (index < 0 || index >= files.length) {
                        return { content: [{ type: "text", text: "Invalid ID." }], isError: true };
                    }
                    fileToResolve = files[index];
                } else if (path) {
                    let normalizedPath = path;
                    if (nodePath.isAbsolute(path)) {
                        normalizedPath = nodePath.relative(projectPath, path);
                    }

                    if (files.includes(normalizedPath)) {
                        fileToResolve = normalizedPath;
                    } else {
                        return { content: [{ type: "text", text: `File not found in conflicted files. Searched for: ${normalizedPath}` }], isError: true };
                    }
                }

                if (!fileToResolve) {
                    return { content: [{ type: "text", text: "Could not determine file to resolve." }], isError: true };
                }

                // Execute resolution based on type
                let message: string;
                switch (resolutionType) {
                    case "delete":
                        await runGit(["rm", fileToResolve]);
                        message = `Resolved by deleting (git rm) ${fileToResolve}`;
                        break;

                    case "add":
                        await runGit(["add", fileToResolve]);
                        message = `Resolved by adding (git add) ${fileToResolve}`;
                        break;

                    case "resolve":
                    default:
                        await runGit(["add", fileToResolve]);
                        message = `Resolved (git add) ${fileToResolve}`;
                        break;
                }

                return { content: [{ type: "text", text: message }] };
            } catch (e: any) {
                return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
            }
        }
    );
}
