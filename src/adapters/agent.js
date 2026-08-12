import { runProcess } from "../run-command.js";

function renderArgs(args, prompt) {
  return args.map((arg) => arg.replaceAll("{prompt}", prompt));
}

export async function runAgent(cwd, spec, prompt) {
  return runProcess(spec.command, renderArgs(spec.args, prompt), { cwd, timeoutMs: spec.timeoutMs });
}
