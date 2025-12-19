import { createHash } from "crypto";

/**
 * Generate a consistent ID for a file path.
 * This ID should be used throughout the application to refer to this file.
 * It is deterministic based on the file path.
 */
export function generateId(filePath: string): string {
    return createHash("sha256").update(filePath).digest("hex").substring(0, 8);
}
