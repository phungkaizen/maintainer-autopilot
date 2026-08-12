import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { allGatesPass, runGates } from "../src/finalizer.js";

test("finalizer stops after first failing gate", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "autopilot-gates-"));
  try {
    const gates = await runGates(cwd, [
      { name: "pass", command: "printf pass" },
      { name: "fail", command: "printf nope >&2; exit 7" },
      { name: "never", command: "exit 0" }
    ]);
    assert.equal(gates.length, 2);
    assert.equal(gates[0]?.ok, true);
    assert.equal(gates[1]?.ok, false);
    assert.equal(allGatesPass(gates), false);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
