#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { initConfig, loadConfig } from "./config.js";
import { acquireWriterLock, forceUnlock, readWriterLock, releaseWriterLock } from "./lock.js";
import { createTask, restartRepair, transition } from "./state-machine.js";
import { loadState, saveState } from "./store.js";
import { executeCandidate } from "./orchestrator.js";
import { createPr, isPrMerged, mergePr, pushCurrentBranch, waitForChecks } from "./adapters/github-gh.js";
import { assertTaskBranch, createCandidateCommit, createTaskBranch } from "./git.js";

function usage(exitCode = 0) {
  const text = `maintainer-autopilot

Commands:
  init
  status [--json]
  run --task <id> (--prompt <text> | --prompt-file <path>)
  repair (--prompt <text> | --prompt-file <path>)
  promote [--title <title>]
  checkpoint
  unlock --force

One task lineage and one active writer per workspace. Auto-merge is off by default.`;
  (exitCode === 0 ? console.log : console.error)(text);
  process.exit(exitCode);
}

function valueOf(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

async function promptFrom(args, cwd) {
  const direct = valueOf(args, "--prompt");
  const file = valueOf(args, "--prompt-file");
  if (direct && file) throw new Error("choose --prompt or --prompt-file, not both");
  if (direct) return direct;
  if (file) return readFile(path.resolve(cwd, file), "utf8");
  throw new Error("missing --prompt or --prompt-file");
}

async function cmdStatus(cwd, args) {
  const state = await loadState(cwd);
  const lock = await readWriterLock(cwd);
  if (args.includes("--json")) return console.log(JSON.stringify({ ...state, lock }, null, 2));
  console.log(`active_writer: ${lock?.owner ?? "null"}`);
  if (!state.task) return console.log("task: none");
  console.log(`task: ${state.task.taskId}`);
  console.log(`status: ${state.task.status}`);
  console.log(`attempt: ${state.task.attempt}`);
  if (state.task.branch) console.log(`branch: ${state.task.branch}`);
  if (state.task.candidate?.commitSha) console.log(`candidate: ${state.task.candidate.commitSha}`);
  if (state.task.prUrl) console.log(`pr: ${state.task.prUrl}`);
  if (state.task.lastError) console.log(`last_error: ${state.task.lastError.slice(0, 500)}`);
}

async function withWriter(cwd, taskId, fn) {
  await acquireWriterLock(cwd, taskId);
  const state = await loadState(cwd);
  state.activeWriter = taskId;
  await saveState(cwd, state);
  try {
    await fn();
  } finally {
    const latest = await loadState(cwd);
    latest.activeWriter = null;
    await saveState(cwd, latest);
    await releaseWriterLock(cwd, taskId);
  }
}

async function cmdRun(cwd, args) {
  const taskId = valueOf(args, "--task");
  if (!taskId) throw new Error("missing --task");
  const prompt = await promptFrom(args, cwd);
  await initConfig(cwd);
  const config = await loadConfig(cwd);

  await withWriter(cwd, taskId, async () => {
    const state = await loadState(cwd);
    if (state.task && state.task.status !== "CHECKPOINTED") {
      throw new Error(`existing task ${state.task.taskId} is ${state.task.status}; repair/checkpoint it before starting another`);
    }
    const branch = await createCandidateBranch(cwd, taskId, config);
    const task = { ...createTask(taskId, prompt), branch };
    state.task = task;
    await saveState(cwd, state);
    const result = await executeCandidate(cwd, config, state, task);
    console.log(`status: ${result.status}`);
  });
}

async function createCandidateBranch(cwd, taskId, config) {
  return createTaskBranch(cwd, taskId, config.github.baseBranch, config.github.branchPrefix);
}

async function cmdRepair(cwd, args) {
  const prompt = await promptFrom(args, cwd);
  const state = await loadState(cwd);
  if (!state.task) throw new Error("no task to repair");
  const taskId = state.task.taskId;

  await withWriter(cwd, taskId, async () => {
    const latest = await loadState(cwd);
    if (!latest.task) throw new Error("task disappeared");
    if (!latest.task.branch) throw new Error("task has no recorded branch");
    await assertTaskBranch(cwd, latest.task.branch);
    const repaired = restartRepair(latest.task, prompt);
    latest.task = repaired;
    await saveState(cwd, latest);
    const result = await executeCandidate(cwd, await loadConfig(cwd), latest, repaired);
    console.log(`status: ${result.status}`);
  });
}

async function cmdPromote(cwd, args) {
  const config = await loadConfig(cwd);
  if (!config.github.enabled) throw new Error("github integration is disabled in config.json");
  const state = await loadState(cwd);
  if (!state.task || state.task.status !== "READY_TO_PROMOTE") throw new Error("task must be READY_TO_PROMOTE");
  const taskId = state.task.taskId;
  const title = valueOf(args, "--title") ?? `autopilot: ${taskId}`;

  await withWriter(cwd, taskId, async () => {
    const latest = await loadState(cwd);
    if (!latest.task || latest.task.status !== "READY_TO_PROMOTE") throw new Error("promotion state changed");
    if (!latest.task.branch) throw new Error("task has no recorded branch");
    await assertTaskBranch(cwd, latest.task.branch);

    const commitTitle = latest.task.attempt > 1 ? `${title} (repair ${latest.task.attempt})` : title;
    const candidate = await createCandidateCommit(cwd, commitTitle);
    latest.task = { ...latest.task, candidate };
    await saveState(cwd, latest);
    await pushCurrentBranch(cwd);

    let prUrl = latest.task.prUrl;
    let task;
    if (prUrl) {
      task = transition(latest.task, "PR_OPEN", "existing pull request updated");
    } else {
      prUrl = await createPr(
        cwd,
        title,
        `Automated maintenance task \`${taskId}\`.\n\nMaintainer Autopilot review and deterministic gates passed before promotion. Candidate: \`${candidate.commitSha}\`.`,
        config.github.baseBranch
      );
      task = transition({ ...latest.task, prUrl }, "PR_OPEN", "pull request created");
    }
    latest.task = task;
    await saveState(cwd, latest);

    task = transition(task, "CI", "waiting for GitHub checks");
    latest.task = task;
    await saveState(cwd, latest);

    try {
      await waitForChecks(cwd, prUrl);
    } catch (error) {
      task = transition(task, "REPAIR_REQUIRED", "GitHub checks failed");
      task.lastError = error.message;
      latest.task = task;
      await saveState(cwd, latest);
      console.log(`status: ${task.status}`);
      console.log(`pr: ${prUrl}`);
      return;
    }

    if (config.github.autoMerge) {
      await mergePr(cwd, prUrl);
      task = transition(task, "MERGED", "GitHub checks passed and PR merged");
      task = transition(task, "CHECKPOINTED", "automatic checkpoint after merge");
    }
    latest.task = task;
    await saveState(cwd, latest);
    console.log(`status: ${task.status}`);
    console.log(`pr: ${prUrl}`);
  });
}

async function cmdCheckpoint(cwd) {
  const state = await loadState(cwd);
  if (!state.task) throw new Error("no task");

  if (state.task.status === "CI") {
    if (!state.task.prUrl) throw new Error("CI task has no pull request URL");
    if (!(await isPrMerged(cwd, state.task.prUrl))) throw new Error("pull request is not merged yet");
    state.task = transition(state.task, "MERGED", "verified merged pull request");
  }

  if (state.task.status !== "READY_TO_PROMOTE" && state.task.status !== "MERGED") {
    throw new Error(`cannot checkpoint from ${state.task.status}`);
  }
  state.task = transition(state.task, "CHECKPOINTED", "manual checkpoint");
  await saveState(cwd, state);
  console.log("status: CHECKPOINTED");
}

async function main() {
  const cwd = process.cwd();
  const [, , command, ...args] = process.argv;
  if (!command || command === "help" || command === "--help" || command === "-h") usage(0);
  if (command === "init") {
    const file = await initConfig(cwd);
    return console.log(`initialized ${path.relative(cwd, file)}`);
  }
  if (command === "status") return cmdStatus(cwd, args);
  if (command === "run") return cmdRun(cwd, args);
  if (command === "repair") return cmdRepair(cwd, args);
  if (command === "promote") return cmdPromote(cwd, args);
  if (command === "checkpoint") return cmdCheckpoint(cwd);
  if (command === "unlock") {
    if (!args.includes("--force")) throw new Error("unlock requires --force; inspect the writer first with status");
    await forceUnlock(cwd);
    const state = await loadState(cwd);
    state.activeWriter = null;
    await saveState(cwd, state);
    return console.log("lock cleared");
  }
  usage(2);
}

main().catch((error) => {
  console.error(`error: ${error.message}`);
  process.exit(1);
});
