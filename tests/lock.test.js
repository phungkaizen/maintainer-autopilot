import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { acquireWriterLock, readWriterLock, releaseWriterLock } from "../src/lock.js";

test("single-writer lock rejects a second writer", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "autopilot-lock-"));
  try {
    await acquireWriterLock(cwd, "issue-1");
    await assert.rejects(() => acquireWriterLock(cwd, "issue-2"), /single-writer invariant/);
    assert.equal((await readWriterLock(cwd))?.owner, "issue-1");
    await releaseWriterLock(cwd, "issue-1");
    assert.equal(await readWriterLock(cwd), null);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
