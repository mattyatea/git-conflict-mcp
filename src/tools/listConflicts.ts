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
                extension: z.string().optional().describe("Filter by file extension (e.g. 'ts', '.ts')."),
            }),
        },
        async ({ page, extension }) => {
            const pageNum = page || 1;
            const pageSize = 50;
            try {
                const allFiles = await getConflictedFiles();

                // Map to objects with original ID
                let filesWithIds = allFiles.map((file, index) => ({
                    file,
                    id: (index + 1).toString()
                }));

                if (extension) {
                    const ext = extension.startsWith('.') ? extension : `.${extension}`;
                    filesWithIds = filesWithIds.filter(item => item.file.endsWith(ext));
                }

                const start = (pageNum - 1) * pageSize;
                const end = start + pageSize;
                const slice = filesWithIds.slice(start, end);

                const result: Record<string, string> = {};
                slice.forEach((item) => {
                    result[item.id] = item.file;
                });

                if (filesWithIds.length > end) {
                    result["isMoreConflict"] = "true";
                }

                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            } catch (e: any) {
                return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
            }
        }
    );
}
