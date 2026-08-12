import { open, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { ensureMetaDir, META_DIR } from "./config.js";

const LOCK_FILE = "active-writer.lock";

export async function acquireWriterLock(cwd, owner) {
  const dir = await ensureMetaDir(cwd);
  const file = path.join(dir, LOCK_FILE);
  const lock = { owner, acquiredAt: new Date().toISOString(), pid: process.pid };

  try {
    const handle = await open(file, "wx", 0o600);
    await handle.writeFile(`${JSON.stringify(lock)}\n`, "utf8");
    await handle.close();
    return lock;
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    let existing = "unknown writer";
    try {
      existing = JSON.parse(await readFile(file, "utf8")).owner;
    } catch {
      // Keep the lock. Recovery is explicit when metadata cannot be trusted.
    }
    throw new Error(`single-writer invariant: workspace already locked by ${existing}`);
  }
}

export async function readWriterLock(cwd) {
  const file = path.join(cwd, META_DIR, LOCK_FILE);
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export async function releaseWriterLock(cwd, owner) {
  const file = path.join(cwd, META_DIR, LOCK_FILE);
  const existing = await readWriterLock(cwd);
  if (!existing) return;
  if (existing.owner !== owner) throw new Error(`refusing to release lock owned by ${existing.owner}`);
  await unlink(file);
}

export async function forceUnlock(cwd) {
  const file = path.join(cwd, META_DIR, LOCK_FILE);
  try {
    await unlink(file);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
