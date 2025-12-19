import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPendingResolves } from "../webui/server.js";

export function registerListPendingResolves(server: McpServer) {
    server.registerTool(
        "list_pending_resolutions",
        {
            description: "List conflicts that are pending resolution (waiting for review). Returns a list of pending items with their IDs, file paths, and resolution types. Use this to review proposed changes.",
            inputSchema: z.object({
                page: z.number().optional().describe("Page number (1-based). Default is 1."),
            }),
        },
        async ({ page }) => {
            const { getReviewMode } = await import("../webui/server.js");
            if (!getReviewMode()) {
                return { content: [{ type: "text", text: "This tool is only available in review mode (--review)." }], isError: true };
            }

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
                    type: item.type,
                    reason: item.reason,
                    timestamp: new Date(item.timestamp).toISOString()
                }));

                const response: Record<string, any> = {
                    pending: result,
                    total: pendingResolves.length,
                    page: pageNum
                };

                if (pendingResolves.length > end) {
                    response["hasMore"] = true;
                }

                return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
            } catch (e: any) {
                return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
            }
        }
    );
}
