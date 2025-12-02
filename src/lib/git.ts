import { state } from "./state.js";

export async function runGit(args: string[]): Promise<string> {
  const projectPath = state.getProjectPath();
  if (!projectPath) {
    throw new Error("Project not initialized. Call init_project first.");
  }
  
  // Bun.spawn is specific to Bun runtime
  const proc = Bun.spawn(["git", ...args], {
    cwd: projectPath,
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
      throw new Error(`Git command failed: ${stderr || stdout}`);
  }
  return stdout;
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
