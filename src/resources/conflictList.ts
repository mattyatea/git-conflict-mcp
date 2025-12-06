import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getConflictedFilesWithStatus } from "../lib/git.js";

export function registerConflictListResource(server: McpServer) {
    // Register resource using the modern registerResource API
    server.registerResource(
        "Git Conflict List",
        "conflict://list",
        {
            description: "List of all files with git conflicts including conflict types and resolution suggestions",
            mimeType: "application/json"
        },
        async (uri) => {
            try {
                const allConflicts = await getConflictedFilesWithStatus();

                // Assign IDs to conflicts
                const conflictsWithIds = allConflicts.map((conflict, index) => ({
                    ...conflict,
                    id: (index + 1).toString()
                }));

                const result: Record<string, any> = {};

                conflictsWithIds.forEach((item) => {
                    const suggestion = getResolutionSuggestion(item.status);
                    result[item.id] = {
                        file: item.file,
                        conflictType: item.conflictType,
                        fileSize: item.fileSize !== undefined ? `${item.fileSize} bytes` : "N/A (file deleted)",
                        suggestion: suggestion
                    };
                });

                return {
                    contents: [
                        {
                            uri: uri.toString(),
                            mimeType: "application/json",
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                };
            } catch (e: any) {
                return {
                    contents: [
                        {
                            uri: uri.toString(),
                            mimeType: "application/json",
                            text: JSON.stringify({ error: e.message }, null, 2)
                        }
                    ]
                };
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
