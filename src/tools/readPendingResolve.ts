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
            outputSchema: z.object({
                id: z.string().describe("The ID of the pending resolution file."),
                filePath: z.string().describe("The path of the file."),
                type: z.string().describe("The type of the conflict (add, remove, modify)."),
                reason: z.string().optional().describe("The reason for the conflict."),
                gitDiff: z.string().optional().describe("The git diff of the conflict."),
                fileContent: z.string().optional().describe("The content of the file."),
                timestamp: z.string().describe("The timestamp of the conflict.")
            })
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

            const structuredData = {
                id: found.id,
                filePath: found.filePath,
                type: found.type,
                reason: found.reason,
                gitDiff: found.gitDiff,
                fileContent: found.fileContent,
                timestamp: new Date(found.timestamp).toISOString()
            };

            return {
                content: [{
                    type: "text",
                    text: JSON.stringify(structuredData, null, 2)
                }],
                structuredContent: structuredData
            };
        }
    );
}
