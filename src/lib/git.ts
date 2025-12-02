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
