import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { getConflictedFiles } from "../lib/git.js";
import { state } from "../lib/state.js";
import { rateLimiter } from "../lib/rateLimit.js";

export function registerReadConflict(server: McpServer) {
    server.registerTool(
        "read_conflict",
        {
            description: "Read the content of a conflicted file by its ID.",
            inputSchema: z.object({
                id: z.string().describe("The ID of the file to read (from list_conflicts)."),
            }),
        },
        async ({ id }) => {
            if (!rateLimiter.check("read_conflict", 5, 60 * 1000)) {
                return { content: [{ type: "text", text: "Rate limit exceeded. You can only read 5 conflicts per minute." }], isError: true };
            }
            const projectPath = state.getProjectPath();
            if (!projectPath) return { content: [{ type: "text", text: "Project not initialized." }], isError: true };
            try {
                const files = await getConflictedFiles();
                const index = parseInt(id) - 1;
                if (index < 0 || index >= files.length) {
                    return { content: [{ type: "text", text: "Invalid ID." }], isError: true };
                }
                const file = files[index];
                if (!file) {
                    return { content: [{ type: "text", text: "Invalid ID (file not found)." }], isError: true };
                }
                const fullPath = path.join(projectPath, file);
                const content = await fs.readFile(fullPath, "utf-8");
                return { content: [{ type: "text", text: content }] };
            } catch (e: any) {
                return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
            }
        }
    );
}
