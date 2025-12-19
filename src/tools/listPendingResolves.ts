import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPendingResolves } from "../webui/server.js";

export function registerListPendingResolves(server: McpServer) {
    server.registerTool(
        "list_pending_resolutions",
        {
            description: "List conflicts that are pending resolution. Returns a simplified list containing only the file ID and file path. Use read_pending_resolution to see details.",
            inputSchema: z.object({
                page: z.number().optional().describe("Page number (1-based). Default is 1."),
            }),
            outputSchema: z.object({
                pending: z.array(z.object({
                    id: z.string(),
                    filePath: z.string(),
                })).describe("List of pending resolutions."),
                total: z.number().describe("Total number of pending resolutions."),
                page: z.number().describe("Current page number."),
                hasMore: z.boolean().optional().describe("True if there are more pages.")
            })
        },
        async ({ page }) => {

            const pageNum = page || 1;
            const pageSize = 20;

            try {
                // Fetch pending resolves (local or external)
                const pendingResolves = await getPendingResolves();

                const start = (pageNum - 1) * pageSize;
                const end = start + pageSize;
                const slice = pendingResolves.slice(start, end);

                const result = slice.map(item => ({
                    id: item.id,
                    filePath: item.filePath,
                }));

                const response: Record<string, any> = {
                    pending: result,
                    total: pendingResolves.length,
                    page: pageNum
                };

                if (pendingResolves.length > end) {
                    response["hasMore"] = true;
                }

                return {
                    content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
                    structuredContent: response
                };
            } catch (e: any) {
                return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
            }
        }
    );
}
