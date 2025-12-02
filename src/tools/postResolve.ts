import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerPostResolve(server: McpServer) {
    server.registerTool(
        "post_resolve",
        {
            description: "Execute this tool BEFORE running resolve_conflict to confirm the resolution process.",
            inputSchema: z.object({}),
        },
        async () => {
            return {
                content: [{
                    type: "text",
                    text: "Are you sure you have resolved the conflict correctly? Please check again."
                }]
            };
        }
    );
}
