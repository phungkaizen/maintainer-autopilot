import { runProcess } from "../run-command.js";
import { currentBranch } from "../git.js";

async function gh(cwd, args) {
  const result = await runProcess("gh", args, { cwd, timeoutMs: 30 * 60_000 });
  if (result.exitCode !== 0) throw new Error(`gh ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

export async function pushCurrentBranch(cwd) {
  const branch = await currentBranch(cwd);
  if (!branch) throw new Error("cannot promote from a detached HEAD");
  const result = await runProcess("git", ["push", "-u", "origin", branch], { cwd, timeoutMs: 10 * 60_000 });
  if (result.exitCode !== 0) throw new Error(result.stderr || "git push failed");
}

export async function createPr(cwd, title, body, baseBranch) {
  return gh(cwd, ["pr", "create", "--title", title, "--body", body, "--base", baseBranch]);
}

export async function waitForChecks(cwd, prUrl) {
  await gh(cwd, ["pr", "checks", prUrl, "--watch", "--fail-fast"]);
}

export async function mergePr(cwd, prUrl) {
  await gh(cwd, ["pr", "merge", prUrl, "--squash", "--delete-branch"]);
}

export async function isPrMerged(cwd, prUrl) {
  const output = await gh(cwd, ["pr", "view", prUrl, "--json", "mergedAt", "--jq", ".mergedAt != null"]);
  return output === "true";
}
