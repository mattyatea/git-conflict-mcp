import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getConflictedFilesWithStatus } from "../lib/git.js";
import { rateLimiter } from "../lib/rateLimit.js";
import { getPendingResolves } from "../webui/server.js";

export function registerListConflicts(server: McpServer) {
    server.registerTool(
        "list_conflicts",
        {
            description: "List files with git conflicts including conflict types. Returns a map of ID to file info with conflict type and suggested resolution. (Rate limit: 2 calls per minute)",
            inputSchema: z.object({
                page: z.number().optional().describe("Page number (1-based). Default is 1."),
                extension: z.string().optional().describe("Filter by file extension (e.g. 'ts', '.ts')."),
                path: z.string().optional().describe("Filter by file path (substring match)."),
                showTypes: z.boolean().optional().describe("Show detailed conflict types and resolution suggestions. Default is true."),
            }),
        },
        async ({ page, extension, path, showTypes }) => {
            if (!rateLimiter.check("list_conflicts", 2, 60 * 1000)) {
                return { content: [{ type: "text", text: "Please fix the conflicted files that have already been provided." }], isError: true };
            }

            const pageNum = page || 1;
            const pageSize = 20;
            const includeTypes = showTypes !== false; // Default to true

            try {
                const allConflicts = await getConflictedFilesWithStatus();

                // Assign IDs before filtering so they match the index in getConflictedFiles()
                const conflictsWithIds = allConflicts.map((conflict, index) => ({
                    ...conflict,
                    id: (index + 1).toString()
                }));

                // Fetch pending resolves (local or external)
                const pendingResolves = await getPendingResolves();
                const pendingPaths = new Set(pendingResolves.map(p => p.filePath));

                // Filter out conflicts that are already in the pending list
                let filteredConflicts = conflictsWithIds.filter(c => !pendingPaths.has(c.file));

                // Apply filters
                if (extension) {
                    const ext = extension.startsWith('.') ? extension : `.${extension}`;
                    filteredConflicts = filteredConflicts.filter(c => c.file.endsWith(ext));
                }

                if (path) {
                    filteredConflicts = filteredConflicts.filter(c => c.file.includes(path));
                }

                const start = (pageNum - 1) * pageSize;
                const end = start + pageSize;
                const slice = filteredConflicts.slice(start, end);

                const result: Record<string, any> = {};

                if (includeTypes) {
                    // Include detailed information with conflict types
                    slice.forEach((item) => {
                        const suggestion = getResolutionSuggestion(item.status);
                        result[item.id] = {
                            file: item.file,
                            conflictType: item.conflictType,
                            fileSize: item.fileSize !== undefined ? `${item.fileSize} bytes` : "N/A (file deleted)",
                            suggestion: suggestion
                        };
                    });
                } else {
                    // Simple format: just ID to file path
                    slice.forEach((item) => {
                        result[item.id] = item.file;
                    });
                }

                if (filteredConflicts.length > end) {
                    result["isMoreConflict"] = "true";
                }

                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            } catch (e: any) {
                return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
            }
        }
    );
}

/**
 * Get resolution suggestion based on conflict status
 */
function getResolutionSuggestion(status: string): string {
    switch (status) {
        case "DD":
            return "Both sides deleted - use type='delete' to confirm deletion";
        case "AU":
            return "Added by us - use type='add' to keep our version";
        case "UD":
            return "Deleted by them - use type='delete' to accept deletion, or edit and use type='resolve' to keep";
        case "UA":
            return "Added by them - use type='add' to accept their version";
        case "DU":
            return "Deleted by us - use type='delete' to confirm deletion, or edit and use type='resolve' to restore";
        case "AA":
            return "Both added - edit and use type='resolve'";
        case "UU":
            return "Both modified - edit and use type='resolve'";
        default:
            return "Use type='resolve' after editing";
    }
}

