import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPendingResolves } from "../webui/server.js";

export function registerReadPendingResolve(server: McpServer) {
    server.registerTool(
        "read_pending_resolution",
        {
            description: "Read the details of a conflict that is pending resolution. Returns the file content, diff, and reason.",
            inputSchema: z.object({
                id: z.string().describe("The ID of the pending resolution file."),
            }),
        },
        async ({ id }) => {
            const pending = await getPendingResolves();
            const found = pending.find(p => p.id === id);

            if (!found) {
                return {
                    content: [{ type: "text", text: `Error: Pending resolution with ID ${id} not found.` }],
                    isError: true
                };
            }

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        id: found.id,
                        filePath: found.filePath,
                        type: found.type,
                        reason: found.reason,
                        gitDiff: found.gitDiff,
                        fileContent: found.fileContent,
                        timestamp: new Date(found.timestamp).toISOString()
                    }, null, 2)
                }]
            };
        }
    );
}
