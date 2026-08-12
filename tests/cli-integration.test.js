import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const cli = path.resolve("src/cli.js");

async function run(cwd, args) {
  return exec(process.execPath, [cli, ...args], { cwd, env: process.env });
}

test("CLI creates a task branch, enforces the pipeline, and releases writer lock", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "autopilot-cli-"));
  try {
    await exec("git", ["init", "-b", "main"], { cwd });
    await exec("git", ["config", "user.name", "Test User"], { cwd });
    await exec("git", ["config", "user.email", "test@example.com"], { cwd });
    await writeFile(path.join(cwd, "README.md"), "fixture\n");
    await exec("git", ["add", "README.md"], { cwd });
    await exec("git", ["commit", "-m", "init"], { cwd });

    await run(cwd, ["init"]);
    const config = {
      version: 1,
      agent: { command: "/bin/sh", args: ["-lc", "{prompt}"], timeoutMs: 10_000 },
      review: {
        enabled: true,
        command: "/bin/sh",
        args: ["-lc", "printf AUTOPILOT_REVIEW_PASS"],
        timeoutMs: 10_000,
        passPattern: "AUTOPILOT_REVIEW_PASS"
      },
      gates: [{ name: "candidate", command: "test -f candidate.txt", timeoutMs: 10_000 }],
      github: { enabled: false, baseBranch: "main", branchPrefix: "autopilot/", autoMerge: false }
    };
    await writeFile(path.join(cwd, ".maintainer-autopilot", "config.json"), `${JSON.stringify(config, null, 2)}\n`);

    const result = await run(cwd, ["run", "--task", "issue-1", "--prompt", "printf candidate > candidate.txt"]);
    assert.match(result.stdout, /status: READY_TO_PROMOTE/);

    const state = JSON.parse(await readFile(path.join(cwd, ".maintainer-autopilot", "state.json"), "utf8"));
    assert.equal(state.activeWriter, null);
    assert.equal(state.task.status, "READY_TO_PROMOTE");
    assert.equal(state.task.branch, "autopilot/issue-1");
    assert.equal((await exec("git", ["branch", "--show-current"], { cwd })).stdout.trim(), "autopilot/issue-1");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
