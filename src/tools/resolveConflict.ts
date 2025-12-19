import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as path from "path";
import { getConflictedFiles } from "../lib/git.js";
import { generateId } from "../lib/id.js";
import { state } from "../lib/state.js";
import { addPendingResolve } from "../webui/server.js";

export function registerResolveConflict(server: McpServer) {
    server.registerTool(
        "resolve_conflict",
        {
            description: "Request conflict resolution by its ID or file path. The actual resolution will be performed by a human through the WebUI. Supports different resolution types for various conflict scenarios (content conflicts, delete/modify conflicts, etc.). You must run post_resolve before running this tool.",
            inputSchema: z.object({
                id: z.string().optional().describe("The ID of the file to resolve (from list_conflicts)."),
                path: z.string().optional().describe("The file path to resolve."),
                type: z.enum(["resolve", "delete", "add"]).optional().default("resolve").describe("Resolution type. Default is 'resolve'."),
                reason: z.string().optional().describe("The reason why this resolution is valid."),
                force: z.boolean().optional().describe("Force resolution, bypassing the safety check."),
            }),
        },
        async ({ id, path: filePath, type, reason, force }) => {
            try {
                const projectPath = state.getProjectPath();
                if (!projectPath) {
                    return { content: [{ type: "text", text: "Project not initialized. Run init_project first." }], isError: true };
                }

                const files = await getConflictedFiles();
                let fileToResolve: string | undefined;

                if (id) {
                    fileToResolve = files.find(f => generateId(f) === id);
                    if (!fileToResolve) {
                        return { content: [{ type: "text", text: "Invalid ID." }], isError: true };
                    }
                } else if (filePath) {
                    let normalizedPath = filePath;
                    if (path.isAbsolute(filePath)) {
                        normalizedPath = path.relative(projectPath, filePath);
                    }
                    if (files.includes(normalizedPath)) {
                        fileToResolve = normalizedPath;
                    } else {
                        return { content: [{ type: "text", text: `File not found in conflicted files. Searched for: ${normalizedPath}` }], isError: true };
                    }
                }

                if (!fileToResolve) {
                    return { content: [{ type: "text", text: "Could not determine file to resolve. Please provide id or path." }], isError: true };
                }

                const absolutePath = path.join(projectPath, fileToResolve);
                const resolutionType = type || "resolve";

                const result = await addPendingResolve({
                    filePath: fileToResolve,
                    absolutePath,
                    projectPath,
                    type: resolutionType,
                    reason,
                });

                if (!result.success) {
                    return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
                }

                return {
                    content: [{
                        type: "text",
                        text: `Request sent!\n\nFile: ${fileToResolve}`
                    }]
                };

            } catch (e: any) {
                return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
            }
        }
    );
}
