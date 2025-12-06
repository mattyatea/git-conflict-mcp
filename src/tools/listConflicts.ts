import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getConflictedFiles } from "../lib/git.js";
import { rateLimiter } from "../lib/rateLimit.js";

export function registerListConflicts(server: McpServer) {
    server.registerTool(
        "list_conflicts",
        {
            description: "List files with git conflicts. Returns a map of ID to file path. (Rate limit: 2 calls per minute)",
            inputSchema: z.object({
                page: z.number().optional().describe("Page number (1-based). Default is 1."),
                extension: z.string().optional().describe("Filter by file extension (e.g. 'ts', '.ts')."),
                path: z.string().optional().describe("Filter by file path (substring match)."),
            }),
        },
        async ({ page, extension, path }) => {
            if (!rateLimiter.check("list_conflicts", 2, 60 * 1000)) {
                return { content: [{ type: "text", text: "Please fix the conflicted files that have already been provided." }], isError: true };
            }

            const pageNum = page || 1;
            const pageSize = 20;
            try {
                const allFiles = await getConflictedFiles();

                // Apply filters first
                let filteredFiles = allFiles;

                if (extension) {
                    const ext = extension.startsWith('.') ? extension : `.${extension}`;
                    filteredFiles = filteredFiles.filter(file => file.endsWith(ext));
                }

                if (path) {
                    filteredFiles = filteredFiles.filter(file => file.includes(path));
                }

                // Assign IDs after filtering so they are sequential
                const filesWithIds = filteredFiles.map((file, index) => ({
                    file,
                    id: (index + 1).toString()
                }));

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
