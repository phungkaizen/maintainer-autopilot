import test from "node:test";
import assert from "node:assert/strict";
import { createTask, restartRepair, transition } from "../src/state-machine.js";

test("valid happy-path transitions reach checkpoint", () => {
  let task = createTask("42", "fix it");
  task = transition(task, "REVIEWING");
  task = transition(task, "FINALIZING");
  task = transition(task, "READY_TO_PROMOTE");
  task = transition(task, "PR_OPEN");
  task = transition(task, "CI");
  task = transition(task, "MERGED");
  task = transition(task, "CHECKPOINTED");
  assert.equal(task.status, "CHECKPOINTED");
  assert.equal(task.history.length, 8);
});

test("invalid transition is rejected", () => {
  const task = createTask("42", "fix it");
  assert.throws(() => transition(task, "CHECKPOINTED"), /invalid transition/);
});

test("repair preserves lineage and increments attempt", () => {
  let task = createTask("42", "first");
  task = transition(task, "REVIEWING");
  task = transition(task, "REPAIR_REQUIRED");
  task = restartRepair(task, "focused repair");
  assert.equal(task.status, "IMPLEMENTING");
  assert.equal(task.attempt, 2);
  assert.equal(task.prompt, "focused repair");
  assert.equal(task.history.at(-1)?.note, "repair attempt started");
});
