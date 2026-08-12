import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureMetaDir, META_DIR } from "./config.js";

const STATE_FILE = "state.json";

export const EMPTY_STATE = {
  version: 1,
  activeWriter: null,
  task: null
};

export async function loadState(cwd) {
  const file = path.join(cwd, META_DIR, STATE_FILE);
  try {
    const parsed = JSON.parse(await readFile(file, "utf8"));
    if (parsed.version !== 1) throw new Error("unsupported state version");
    return parsed;
  } catch (error) {
    if (error?.code === "ENOENT") return structuredClone(EMPTY_STATE);
    throw error;
  }
}

export async function saveState(cwd, state) {
  const dir = await ensureMetaDir(cwd);
  const target = path.join(dir, STATE_FILE);
  const temp = `${target}.tmp-${process.pid}`;
  await writeFile(temp, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await rename(temp, target);
}
