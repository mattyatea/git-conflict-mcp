import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { approvePendingResolve, rejectPendingResolve } from "../webui/server.js";

export function registerResolvePendingResolve(server: McpServer) {
    server.registerTool(
        "resolve_pending_resolution",
        {
            description: "Approve or reject a pending resolution. 'approve' applies the change (git add/rm). 'reject' discards it and logs a reason.",
            inputSchema: z.object({
                id: z.string().describe("The ID of the pending resolution."),
                decision: z.enum(["approve", "reject"]).describe("The decision: 'approve' or 'reject'."),
                comment: z.string().optional().describe("Optional comment explaining the decision (required if rejecting)."),
            }),
        },
        async ({ id, decision, comment }) => {
            if (decision === "reject" && !comment) {
                return {
                    content: [{ type: "text", text: "Error: Comment is required when rejecting a resolution." }],
                    isError: true
                };
            }

            try {
                let result;
                if (decision === "approve") {
                    result = await approvePendingResolve(id, comment);
                } else {
                    result = await rejectPendingResolve(id, comment);
                }

                if (!result.success) {
                    return {
                        content: [{ type: "text", text: `Error: ${result.error}` }],
                        isError: true
                    };
                }

                const msg = decision === "approve"
                    ? ((result as any).message || "Approved and applied changes.")
                    : "Rejected resolution.";

                return {
                    content: [{ type: "text", text: msg }]
                };

            } catch (e: any) {
                return {
                    content: [{ type: "text", text: `Error: ${e.message}` }],
                    isError: true
                };
            }
        }
    );
}
