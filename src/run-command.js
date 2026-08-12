import { spawn } from "node:child_process";

export async function runProcess(executable, args, options) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));

    let timer;
    if (options.timeoutMs) timer = setTimeout(() => child.kill("SIGTERM"), options.timeoutMs);

    child.on("error", reject);
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ exitCode: code, stdout, stderr, durationMs: Date.now() - started });
    });
  });
}

export async function runShell(command, cwd, timeoutMs) {
  return runProcess("/bin/sh", ["-lc", command], { cwd, timeoutMs });
}
