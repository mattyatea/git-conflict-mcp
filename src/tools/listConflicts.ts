import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getConflictedFiles } from "../lib/git.js";

export function registerListConflicts(server: McpServer) {
    server.registerTool(
        "list_conflicts",
        {
            description: "List files with git conflicts. Returns a map of ID to file path.",
            inputSchema: z.object({
                page: z.number().optional().describe("Page number (1-based). Default is 1."),
            }),
        },
        async ({ page }) => {
            const pageNum = page || 1;
            const pageSize = 50;
            try {
                const files = await getConflictedFiles();
                const start = (pageNum - 1) * pageSize;
                const end = start + pageSize;
                const slice = files.slice(start, end);

                const result: Record<string, string> = {};
                slice.forEach((file, index) => {
                    // ID is global index + 1 (as string)
                    const id = (start + index + 1).toString();
                    result[id] = file;
                });

                if (files.length > end) {
                    result["isMoreConflict"] = "true";
                }

                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            } catch (e: any) {
                return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
            }
        }
    );
}
