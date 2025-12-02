import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "fs/promises";
import { state } from "../lib/state.js";

export function registerInitProject(server: McpServer) {
    server.registerTool(
        "init_project",
        {
            description: "Initialize the project by setting the root directory path.",
            inputSchema: z.object({
                path: z.string().describe("Absolute path to the git project root."),
            }),
        },
        async ({ path: p }) => {
            try {
                const stats = await fs.stat(p);
                if (!stats.isDirectory()) {
                    return { content: [{ type: "text", text: "Path is not a directory." }], isError: true };
                }
                state.setProjectPath(p);
                return { content: [{ type: "text", text: `Project initialized at ${p}` }] };
            } catch (e) {
                return { content: [{ type: "text", text: `Invalid path: ${e}` }], isError: true };
            }
        }
    );
}
