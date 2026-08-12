# Architecture

Maintainer Autopilot v0.1 is deliberately local-first. The workspace remains the source of truth for code; the `.maintainer-autopilot` directory stores only orchestration metadata.

## Components

1. **CLI** — explicit operator commands (`run`, `repair`, `promote`, `checkpoint`).
2. **State machine** — rejects invalid lifecycle transitions.
3. **Writer lock** — atomic filesystem lock enforcing one writer per workspace.
4. **Agent adapter** — runs a configurable command. Codex is only the default.
5. **Review adapter** — normally read-only and required to emit a pass marker.
6. **Finalizer** — deterministic commands such as lint, typecheck, tests, and build.
7. **GitHub adapter** — optional `gh`-based PR/check/merge integration.

## Trust boundaries

The orchestrator never assumes an AI completion is proof that code is correct. AI output is one signal; deterministic gates and repository CI remain separate gates.

The filesystem lock is local to one workspace. Distributed locking and multi-host orchestration are future work.

## State ownership

`state.json` contains one active task. v0.1 intentionally avoids a queue because queueing before idempotency/recovery is mature would make duplicate writers easier to create.
