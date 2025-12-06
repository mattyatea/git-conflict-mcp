import { state } from "./state.js";

export async function runGit(args: string[]): Promise<string> {
  const projectPath = state.getProjectPath();
  if (!projectPath) {
    throw new Error("Project not initialized. Call init_project first.");
  }

  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const execFileAsync = promisify(execFile);

  try {
    const { stdout } = await execFileAsync("git", args, { cwd: projectPath });
    return stdout;
  } catch (error: any) {
    // execFile throws if the command fails (non-zero exit code)
    // The error object typically contains stdout and stderr
    const stderr = error.stderr || "";
    const stdout = error.stdout || "";
    throw new Error(`Git command failed: ${stderr || stdout || error.message}`);
  }
}

export async function getConflictedFiles(): Promise<string[]> {
  // git diff --name-only --diff-filter=U
  // This lists files that are Unmerged
  try {
    const output = await runGit(["diff", "--name-only", "--diff-filter=U"]);
    return output.split("\n").map(s => s.trim()).filter(s => s.length > 0).sort();
  } catch (e) {
    // If git fails (e.g. not a repo), rethrow
    throw e;
  }
}

export interface ConflictInfo {
  file: string;
  status: string;
  conflictType: string;
}

/**
 * Get detailed conflict information including conflict types
 * Status codes from git status --porcelain:
 * - DD: both deleted
 * - AU: added by us
 * - UD: deleted by them
 * - UA: added by them
 * - DU: deleted by us
 * - AA: both added
 * - UU: both modified
 */
export async function getConflictedFilesWithStatus(): Promise<ConflictInfo[]> {
  try {
    const output = await runGit(["status", "--porcelain"]);
    const lines = output.split("\n").map(s => s.trim()).filter(s => s.length > 0);

    const conflicts: ConflictInfo[] = [];
    for (const line of lines) {
      // Format: XY filename
      // X = index status, Y = working tree status
      const status = line.substring(0, 2);
      const file = line.substring(3);

      // Only include unmerged files (conflicts)
      if (["DD", "AU", "UD", "UA", "DU", "AA", "UU"].includes(status)) {
        let conflictType: string;
        switch (status) {
          case "DD":
            conflictType = "both deleted";
            break;
          case "AU":
            conflictType = "added by us";
            break;
          case "UD":
            conflictType = "deleted by them";
            break;
          case "UA":
            conflictType = "added by them";
            break;
          case "DU":
            conflictType = "deleted by us";
            break;
          case "AA":
            conflictType = "both added";
            break;
          case "UU":
            conflictType = "both modified";
            break;
          default:
            conflictType = "unknown";
        }

        conflicts.push({ file, status, conflictType });
      }
    }

    return conflicts.sort((a, b) => a.file.localeCompare(b.file));
  } catch (e) {
    throw e;
  }
}

