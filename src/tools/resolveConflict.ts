import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as nodePath from "path";
import { getConflictedFiles } from "../lib/git.js";
import { state } from "../lib/state.js";
import { rateLimiter } from "../lib/rateLimit.js";

const WEBUI_PORT = parseInt(process.env.WEBUI_PORT || "3456");
const WEBUI_URL = `http://localhost:${WEBUI_PORT}`;

const resolutionTypeSchema = z.enum(["resolve", "delete", "add"]).describe(
    "Resolution type:\n" +
    "- 'resolve': Normal resolution (edit content and git add)\n" +
    "- 'delete': Delete the file (git rm)\n" +
    "- 'add': Add the file as-is (git add, for new file conflicts)"
);

async function sendToWebUI(data: {
    filePath: string;
    absolutePath: string;
    projectPath: string;
    type: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const response = await fetch(`${WEBUI_URL}/api/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        return await response.json() as { success: boolean; id?: string; error?: string };
    } catch (e: any) {
        return { success: false, error: `WebUI connection failed: ${e.message}. Make sure the WebUI server is running (npm run webui)` };
    }
}

export function registerResolveConflict(server: McpServer) {
    server.registerTool(
        "resolve_conflict",
        {
            description: "Request conflict resolution by its ID or file path. The actual resolution will be performed by a human through the WebUI. Supports different resolution types for various conflict scenarios (content conflicts, delete/modify conflicts, etc.). You must run post_resolve before running this.",
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

                const absolutePath = nodePath.join(projectPath, fileToResolve);

                // Send to WebUI for human confirmation
                const result = await sendToWebUI({
                    filePath: fileToResolve,
                    absolutePath,
                    projectPath,
                    type: resolutionType,
                });

                if (!result.success) {
                    return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
                }

                const typeLabel = resolutionType === "delete" ? "削除" : resolutionType === "add" ? "追加" : "解決";
                return {
                    content: [{
                        type: "text",
                        text: `✅ 解決リクエストをWebUIに送信しました。\n\nファイル: ${fileToResolve}\nタイプ: ${typeLabel}\nWebUI: ${WEBUI_URL}\n\n人間が確認後、実際の解決が実行されます。`
                    }]
                };
            } catch (e: any) {
                return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
            }
        }
    );
}
