# Maintainer Autopilot

**AI can write the code. Who makes sure it is safe to merge?**

Maintainer Autopilot is a local-first CLI for turning maintenance tasks into **resumable, auditable AI coding pipelines** with a single-writer lock, explicit repair lineage, read-only review, deterministic verification gates, and optional GitHub PR/CI promotion.

It is designed for maintainers and vibe coders who want automation without losing track of which agent is writing, which candidate was verified, or where to resume after a failed run.

> Status: **v0.1 experimental**. Use it on a branch, review every change, and keep auto-merge disabled until you trust your configuration.

## Why this exists

A common AI coding loop looks like this:

`prompt → edits → another agent → more edits → CI fails → retry → which version is authoritative?`

Maintainer Autopilot turns that into a state machine:

```text
IMPLEMENTING
    ↓
REVIEWING
    ↓
FINALIZING ───────────────┐
    ↓                     │
READY_TO_PROMOTE          │
    ↓                     │
PR_OPEN → CI → MERGED     │
    ↓                     │
CHECKPOINTED              │
                          │
REPAIR_REQUIRED ──────────┘
```

Core rule: **one issue, one lineage, one active writer**.

## Safety properties

- **Single writer:** an atomic lock prevents two automation runs from writing the same workspace at once.
- **Persistent state:** `.maintainer-autopilot/state.json` records task status, attempt history, candidate receipts, and gate output.
- **Explicit repair lineage:** a failed review or gate returns `REPAIR_REQUIRED`; repair increments the attempt instead of silently starting a second task.
- **Least-privilege Codex defaults:** implementation uses `codex exec --sandbox workspace-write`; review uses a read-only sandbox.
- **Deterministic finalizer:** configured shell gates run sequentially and stop on first failure.
- **Promotion is separate from implementation:** the verified candidate is committed only after review/gates pass, then pushed to GitHub.
- **Candidate receipt:** promotion records the commit SHA plus SHA-256 hashes for changed files.
- **No duplicate PR on repair:** if CI fails, the task returns to `REPAIR_REQUIRED`; the next promotion updates the same recorded PR.
- **Auto-merge off by default.**

## Requirements

- Node.js 22
- Git
- An agent CLI. The generated config defaults to [OpenAI Codex CLI](https://developers.openai.com/codex/non-interactive-mode), but the command/args are configurable.
- Optional: GitHub CLI (`gh`) for `promote`.

## Install for development

```bash
npm install
npm run check
npm link
```

Then, inside another Git repository:

```bash
maintainer-autopilot init
```

This creates:

```text
.maintainer-autopilot/
└── config.json
```

## First run

Create a task prompt:

```bash
cat > /tmp/task.md <<'TASK'
Fix the failing parser regression.

Requirements:
- reproduce the bug first
- make the smallest correct change
- add regression coverage
- do not change unrelated behavior
TASK
```

Run it from a **clean `main` branch**:

```bash
maintainer-autopilot run --task issue-123 --prompt-file /tmp/task.md
```

The CLI creates a task branch such as `autopilot/issue-123` before handing write access to the agent.

Check state at any time:

```bash
maintainer-autopilot status
maintainer-autopilot status --json
```

If review or a deterministic gate fails, the task becomes `REPAIR_REQUIRED`. Continue the same lineage:

```bash
maintainer-autopilot repair --prompt "Fix only the failing test/typecheck finding. Preserve the existing candidate behavior."
```

When all gates pass, status becomes `READY_TO_PROMOTE`.

## Config

The default generated config uses current Codex non-interactive safety primitives:

```json
{
  "agent": {
    "command": "codex",
    "args": ["exec", "--ephemeral", "--sandbox", "workspace-write", "{prompt}"]
  },
  "review": {
    "enabled": true,
    "command": "codex",
    "args": ["exec", "--ephemeral", "--sandbox", "read-only", "..."]
  }
}
```

Replace these commands to integrate another CLI agent. The orchestrator does not require a specific model provider.

Configure deterministic gates for your repository:

```json
{
  "gates": [
    { "name": "lint", "command": "npm run lint" },
    { "name": "typecheck", "command": "npm run typecheck" },
    { "name": "test", "command": "npm test" },
    { "name": "build", "command": "npm run build" }
  ]
}
```

## Optional GitHub promotion

Maintainer Autopilot can use the authenticated `gh` CLI after the candidate is `READY_TO_PROMOTE`.

Set:

```json
{
  "github": {
    "enabled": true,
    "baseBranch": "main",
    "branchPrefix": "autopilot/",
    "autoMerge": false
  }
}
```

Then:

```bash
maintainer-autopilot promote --title "fix: parser regression"
```

The command commits the verified candidate, records a commit/file-hash receipt, pushes the task branch, opens a PR, moves state to `CI`, and waits for GitHub checks. If a recorded PR already exists (for example after a CI repair), it is reused instead of creating a duplicate. Automatic merge remains disabled unless you explicitly opt in.

After you merge manually, verify and close the lineage with:

```bash
maintainer-autopilot checkpoint
```

When the task is in `CI`, `checkpoint` verifies that the recorded PR is actually merged before moving to `CHECKPOINTED`.

## Recovery

If the process stops, run:

```bash
maintainer-autopilot status --json
```

A writer lock is intentionally not removed by a different process. If you have verified that no writer is still running, clear a stale lock explicitly:

```bash
maintainer-autopilot unlock --force
```

See [docs/RECOVERY.md](docs/RECOVERY.md) before doing this on an important repository.

## Non-goals for v0.1

- No SaaS control plane.
- No hidden cloud worker.
- No automatic secret collection.
- No automatic force-push/reset/clean.
- No multi-writer execution.
- No claim that AI review replaces human review.

## Roadmap

- Tamper-evident/signed receipts and append-only JSONL audit logs
- Git worktree isolation
- GitHub Issue ingestion and stronger PR discovery/idempotency
- Automated repair diagnostics from failed GitHub Actions jobs
- OpenCode/Claude Code adapters
- Structured JSONL audit log
- Pluggable policy engine
- Dashboard / remote controller as an optional layer

## Contributing

Issues and PRs are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and the architecture/safety docs.

## License

MIT
