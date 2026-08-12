const ALLOWED = {
  IMPLEMENTING: ["REVIEWING", "FAILED"],
  REVIEWING: ["FINALIZING", "REPAIR_REQUIRED", "FAILED"],
  FINALIZING: ["READY_TO_PROMOTE", "REPAIR_REQUIRED", "FAILED"],
  REPAIR_REQUIRED: ["IMPLEMENTING", "FAILED"],
  READY_TO_PROMOTE: ["PR_OPEN", "CHECKPOINTED", "FAILED"],
  PR_OPEN: ["CI", "FAILED"],
  CI: ["MERGED", "REPAIR_REQUIRED", "FAILED"],
  MERGED: ["CHECKPOINTED", "FAILED"],
  CHECKPOINTED: [],
  FAILED: ["IMPLEMENTING"]
};

export function createTask(taskId, prompt) {
  const now = new Date().toISOString();
  return {
    taskId,
    prompt,
    status: "IMPLEMENTING",
    attempt: 1,
    createdAt: now,
    updatedAt: now,
    history: [{ at: now, from: "NONE", to: "IMPLEMENTING", note: "task created" }]
  };
}

export function transition(task, to, note) {
  const from = task.status;
  if (!ALLOWED[from]?.includes(to)) throw new Error(`invalid transition ${from} -> ${to}`);
  const now = new Date().toISOString();
  return {
    ...task,
    status: to,
    updatedAt: now,
    history: [...task.history, { at: now, from, to, note }]
  };
}

export function restartRepair(task, prompt) {
  if (task.status !== "REPAIR_REQUIRED" && task.status !== "FAILED") {
    throw new Error(`repair can only restart from REPAIR_REQUIRED or FAILED, got ${task.status}`);
  }
  const next = transition(task, "IMPLEMENTING", "repair attempt started");
  return { ...next, prompt, attempt: task.attempt + 1, lastError: undefined };
}
