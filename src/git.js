import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { runProcess } from "./run-command.js";

async function git(cwd, args, timeoutMs = 60_000) {
  const result = await runProcess("git", args, { cwd, timeoutMs });
  if (result.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  return result.stdout;
}

export async function ensureAutopilotExcluded(cwd) {
  try {
    const rel = (await git(cwd, ["rev-parse", "--git-path", "info/exclude"])).trim();
    const exclude = path.isAbsolute(rel) ? rel : path.join(cwd, rel);
    let current = "";
    try {
      current = await readFile(exclude, "utf8");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    const rules = [
      ".maintainer-autopilot/config.json",
      ".maintainer-autopilot/state.json",
      ".maintainer-autopilot/active-writer.lock",
      ".maintainer-autopilot/logs/"
    ];
    const lines = new Set(current.split(/\r?\n/));
    const missing = rules.filter((rule) => !lines.has(rule));
    if (missing.length) {
      const prefix = current.replace(/\s*$/, "");
      await import("node:fs/promises").then(({ writeFile }) =>
        writeFile(exclude, `${prefix ? `${prefix}\n` : ""}${missing.join("\n")}\n`, "utf8")
      );
    }
  } catch (error) {
    if (!String(error?.message || "").includes("not a git repository")) throw error;
  }
}

export async function assertGitRepository(cwd) {
  const value = (await git(cwd, ["rev-parse", "--is-inside-work-tree"])).trim();
  if (value !== "true") throw new Error("current directory is not a Git worktree");
}

export async function currentBranch(cwd) {
  return (await git(cwd, ["branch", "--show-current"])).trim();
}

export async function assertCleanWorktree(cwd) {
  const status = await git(cwd, ["status", "--porcelain=v1"]);
  if (status.trim()) throw new Error("worktree must be clean before starting a new task");
}

export function safeTaskSlug(taskId) {
  const slug = taskId.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug) throw new Error("task id cannot be converted to a safe branch name");
  return slug.slice(0, 80);
}

export async function createTaskBranch(cwd, taskId, baseBranch, branchPrefix) {
  await assertGitRepository(cwd);
  await assertCleanWorktree(cwd);
  const current = await currentBranch(cwd);
  if (current !== baseBranch) throw new Error(`start new tasks from ${baseBranch}; current branch is ${current || "detached HEAD"}`);
  const branch = `${branchPrefix}${safeTaskSlug(taskId)}`;
  await git(cwd, ["checkout", "-b", branch]);
  return branch;
}

export async function assertTaskBranch(cwd, expected) {
  const current = await currentBranch(cwd);
  if (current !== expected) throw new Error(`task branch mismatch: expected ${expected}, current ${current || "detached HEAD"}`);
}

async function sha256File(file) {
  const bytes = await readFile(file);
  return createHash("sha256").update(bytes).digest("hex");
}

export async function createCandidateCommit(cwd, message) {
  await git(cwd, ["add", "-A"]);
  const namesRaw = await git(cwd, ["diff", "--cached", "--name-only", "-z"]);
  const names = namesRaw.split("\0").filter(Boolean);
  if (names.length === 0) throw new Error("candidate has no changes to commit");

  const files = [];
  for (const name of names) {
    const file = path.join(cwd, name);
    try {
      files.push({ path: name, sha256: await sha256File(file) });
    } catch (error) {
      if (error?.code === "ENOENT") files.push({ path: name, sha256: null });
      else throw error;
    }
  }

  await git(cwd, ["commit", "-m", message], 2 * 60_000);
  const commitSha = (await git(cwd, ["rev-parse", "HEAD"])).trim();
  return { commitSha, files, createdAt: new Date().toISOString() };
}
