# AGENTS.md

## Project intent

Maintainer Autopilot is a local-first orchestration layer for resumable, auditable AI maintenance pipelines. It is not a general-purpose autonomous shell and must preserve repository safety ahead of convenience.

## Required invariants

- Preserve the single-writer invariant. Never create a second active writer while a writer lock exists.
- Never bypass state-machine transitions to make a run appear successful.
- Implementation, deterministic verification, promotion, PR/CI, merge, and checkpoint are separate stages.
- Repair an existing task lineage instead of silently creating a duplicate task or PR.
- Record candidate file hashes before promotion.
- Keep automatic merge disabled by default.
- Do not weaken or delete tests merely to make a gate pass.
- Do not add secrets, tokens, local auth files, or private product data to the repository.

## Toolchain

- Node.js 22.
- Zero runtime dependencies is an intentional design constraint for v0.x unless a change clearly justifies otherwise.
- Run `npm ci` after lockfile changes.
- Run `npm run check` before declaring a candidate ready.

## Change discipline

Prefer small, reviewable changes with deterministic tests. New state transitions require tests for both the allowed path and at least one rejected path. New adapters must fail closed when required external tooling or credentials are unavailable.

## Codex integration

The default implementation adapter uses `codex exec --ephemeral --sandbox workspace-write`. Read-only review uses the read-only sandbox. Do not replace these with broader permissions unless the security model and documentation are updated deliberately.
