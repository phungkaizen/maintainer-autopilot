import { runAgent } from "./adapters/agent.js";
import { allGatesPass, runGates } from "./finalizer.js";
import { saveState } from "./store.js";
import { transition } from "./state-machine.js";

function tail(text, max = 4000) {
  return text.length <= max ? text : text.slice(-max);
}

export async function executeCandidate(cwd, config, state, task) {
  const implementation = await runAgent(cwd, config.agent, task.prompt);
  if (implementation.exitCode !== 0) {
    const failed = transition(task, "FAILED", "implementation command failed");
    failed.lastError = tail(implementation.stderr || implementation.stdout);
    state.task = failed;
    await saveState(cwd, state);
    return failed;
  }

  let current = transition(task, "REVIEWING", "implementation finished");
  state.task = current;
  await saveState(cwd, state);

  if (config.review.enabled) {
    const review = await runAgent(cwd, config.review, "");
    const ok = review.exitCode === 0 && review.stdout.includes(config.review.passPattern);
    current = {
      ...current,
      review: { ok, stdout: tail(review.stdout), stderr: tail(review.stderr), exitCode: review.exitCode }
    };
    if (!ok) {
      current = transition(current, "REPAIR_REQUIRED", "review did not pass");
      current.lastError = tail(review.stdout || review.stderr || "review failed");
      state.task = current;
      await saveState(cwd, state);
      return current;
    }
  }

  current = transition(current, "FINALIZING", "review passed or disabled");
  state.task = current;
  await saveState(cwd, state);

  const gates = await runGates(cwd, config.gates);
  current = { ...current, gates };
  if (!allGatesPass(gates)) {
    current = transition(current, "REPAIR_REQUIRED", "deterministic gate failed");
    const failedGate = gates.find((gate) => !gate.ok);
    current.lastError = failedGate ? tail(failedGate.stderr || failedGate.stdout) : "no gates configured";
  } else {
    current = transition(current, "READY_TO_PROMOTE", "all deterministic gates passed");
  }

  state.task = current;
  await saveState(cwd, state);
  return current;
}
