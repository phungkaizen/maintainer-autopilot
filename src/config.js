import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureAutopilotExcluded } from "./git.js";

export const META_DIR = ".maintainer-autopilot";
export const CONFIG_FILE = "config.json";

export const DEFAULT_CONFIG = {
  version: 1,
  agent: {
    command: "codex",
    args: ["exec", "--ephemeral", "--sandbox", "workspace-write", "{prompt}"],
    timeoutMs: 30 * 60_000
  },
  review: {
    enabled: true,
    command: "codex",
    args: [
      "exec",
      "--ephemeral",
      "--sandbox",
      "read-only",
      "Review the current git diff for correctness, regressions, security issues, and missing tests. End with exactly AUTOPILOT_REVIEW_PASS if no blocking issue remains; otherwise end with AUTOPILOT_REVIEW_FAIL."
    ],
    timeoutMs: 15 * 60_000,
    passPattern: "AUTOPILOT_REVIEW_PASS"
  },
  gates: [
    { name: "test", command: "npm test", timeoutMs: 15 * 60_000 }
  ],
  github: {
    enabled: false,
    baseBranch: "main",
    branchPrefix: "autopilot/",
    autoMerge: false
  }
};

export async function ensureMetaDir(cwd) {
  const dir = path.join(cwd, META_DIR);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function initConfig(cwd) {
  const dir = await ensureMetaDir(cwd);
  await ensureAutopilotExcluded(cwd);
  const file = path.join(dir, CONFIG_FILE);
  try {
    await readFile(file, "utf8");
    return file;
  } catch {
    await writeFile(file, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, "utf8");
    return file;
  }
}

function validateConfig(value) {
  if (!value || typeof value !== "object") throw new Error("config must be an object");
  if (value.version !== 1) throw new Error("unsupported config version");
  if (!value.agent?.command || !Array.isArray(value.agent.args)) throw new Error("invalid agent config");
  if (!value.review || typeof value.review.enabled !== "boolean") throw new Error("invalid review config");
  if (!Array.isArray(value.gates)) throw new Error("gates must be an array");
  for (const gate of value.gates) {
    if (!gate?.name || !gate.command) throw new Error("each gate requires name and command");
  }
  if (!value.github?.baseBranch || !value.github.branchPrefix) throw new Error("invalid github config");
}

export async function loadConfig(cwd) {
  const file = path.join(cwd, META_DIR, CONFIG_FILE);
  const parsed = JSON.parse(await readFile(file, "utf8"));
  validateConfig(parsed);
  return parsed;
}
