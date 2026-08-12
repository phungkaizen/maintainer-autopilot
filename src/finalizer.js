import { runShell } from "./run-command.js";

export async function runGates(cwd, gates) {
  const results = [];
  for (const gate of gates) {
    const result = await runShell(gate.command, cwd, gate.timeoutMs);
    const gateResult = {
      name: gate.name,
      command: gate.command,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      ok: result.exitCode === 0,
      stdout: result.stdout,
      stderr: result.stderr
    };
    results.push(gateResult);
    if (!gateResult.ok) break;
  }
  return results;
}

export function allGatesPass(results) {
  return results.length > 0 && results.every((gate) => gate.ok);
}
