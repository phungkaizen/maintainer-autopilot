# Maintainer Autopilot

**AI can write the code. Who makes sure it is safe to merge?**

Maintainer Autopilot is a local-first CLI for turning maintenance tasks into **resumable, auditable AI coding pipelines** with a single-writer lock, explicit repair lineage, read-only review, deterministic verification gates, and optional GitHub PR/CI promotion.

## Who this is for

Independent developers and vibe coders who already pay for one or more AI coding tools, and do not want their maintenance workflow tied to one provider. **Use the AI access you already have. Keep the workflow when the coding tool changes.**

## Why this matters

The durable parts of maintenance should live outside an individual coding-agent session: task state, the writer lock, repair lineage, deterministic gates, and the GitHub lifecycle. Maintainer Autopilot keeps that execution and safety core local and provider-independent, so you can configure the agent CLI you use today without losing the task's history or controls.

In v0.1, Codex is the default configurable local agent CLI. You can configure another CLI agent, but automatic quota or provider-failure detection and seamless handoff from Codex to OpenCode or another agent are roadmap work—not behavior available today.

> Status: **v0.1 public beta**. Use it on a branch, review every change, and keep auto-merge disabled.

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

## Quickstart: run one local task

Install the published CLI. This workflow assumes Node.js 22, Git, and an authenticated Codex CLI are already available.

```bash
npm install -g maintainer-autopilot
maintainer-autopilot --help
```

Clone or enter the repository you want to maintain. Start from a clean `main` branch; the default configuration requires that branch name and creates a new `autopilot/<task-id>` branch.

```bash
git clone <your-repository-url> demo-repository
cd demo-repository
git switch main
maintainer-autopilot init
```

`init` writes the local configuration and excludes its runtime state from Git:

```text
.maintainer-autopilot/
└── config.json
```

Run one focused task. The default implementation agent can modify this repository, so use a small, reviewable request.

```bash
maintainer-autopilot run \
  --task docs-quickstart \
  --prompt "Improve the README wording only. Do not change runtime behavior."
```

The CLI creates `autopilot/docs-quickstart`, gives the implementation agent workspace-write access, runs its read-only review, then runs the configured deterministic gates. Inspect the result and state:

```bash
maintainer-autopilot status
maintainer-autopilot status --json
```

If review or a deterministic gate fails, the task becomes `REPAIR_REQUIRED`. Continue the same task lineage with a focused repair prompt:

```bash
maintainer-autopilot repair --prompt "Fix only the failing test/typecheck finding. Preserve the existing candidate behavior."
```

When all gates pass, status becomes `READY_TO_PROMOTE`. At this point you can inspect the branch, stop there, or configure the optional GitHub promotion flow below.

## Contributor/development setup

To develop Maintainer Autopilot itself from source, clone the repository, install its dependencies, run its checks, and link the local CLI:

```bash
git clone https://github.com/phungkaizen/maintainer-autopilot.git
cd maintainer-autopilot
npm ci
npm run check
npm link
```

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

Replace these commands to invoke another local CLI agent. The orchestrator does not require a specific model provider, but v0.1 does not automatically detect quota/provider failures or fall back between agents.

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

## v0.1 limitations

This public beta deliberately keeps the operational model narrow:

- It operates in the current Git worktree, not an isolated worktree. Starting a new task requires a clean configured base branch (default: `main`).
- There is one persisted task lineage and one active writer per workspace. A stale writer lock requires a human to confirm that the original process has stopped before `unlock --force`.
- The generated configuration invokes local agent and gate commands. The default implementation command gives Codex workspace-write access; prompts, configuration, and gate commands are operator-controlled trust boundaries.
- Local state is ordinary JSON files. v0.1 does not provide tamper-evident, signed, or append-only audit records.
- GitHub promotion is optional and depends on an authenticated `gh` CLI. It does not automatically discover existing PRs outside the task state, and auto-merge stays disabled unless explicitly enabled in `config.json`.
- A failed GitHub check returns the task to `REPAIR_REQUIRED`, but the operator must supply the repair direction and review the resulting branch and PR. v0.1 does not diagnose or repair CI failures automatically.
- There is no hosted control plane, secret collection, automatic force-push/reset/clean, or claim that AI review replaces human review.
- v0.1 can invoke the configured local agent CLI, with Codex as the default, but it does not provide automatic quota detection, provider-failure detection, or seamless Codex-to-OpenCode/other-agent handoff.
- It has no subscription integration, quota bypass, or automatic subscription-aware/free-local fallback policy.

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

## Roadmap

- Tamper-evident/signed receipts and append-only JSONL audit logs
- Git worktree isolation
- GitHub Issue ingestion and stronger PR discovery/idempotency
- Automated repair diagnostics from failed GitHub Actions jobs
- OpenCode/Claude Code adapters
- Automatic quota/provider-failure detection and seamless handoff between configured agents
- Subscription-aware and free/local fallback policies
- Structured JSONL audit log
- Pluggable policy engine
- Dashboard / remote controller as an optional layer

## Contributing

This is a public beta: try it on a small repository and [open an issue](https://github.com/phungkaizen/maintainer-autopilot/issues) with failures or friction you encounter. Issues and PRs are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and the architecture/safety docs.

## License

MIT
