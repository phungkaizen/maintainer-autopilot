# Recovery

## Process interrupted during implementation

1. Inspect running processes first.
2. Run `maintainer-autopilot status --json`.
3. Inspect the Git diff and repository status.
4. If the original writer is definitely gone, run `maintainer-autopilot unlock --force`.
5. Continue the same task with `repair`; do not start a duplicate task.

## Review or gate failure

The task should already be `REPAIR_REQUIRED`. Read `lastError`, inspect the failed gate output, then issue a focused repair prompt.

## CI failure after PR creation

v0.1 records `CI`, but automated CI-repair continuation is intentionally not implemented yet. Repair the same branch/PR manually and preserve the same task lineage. CI repair idempotency is on the roadmap.

## Why force unlock is explicit

Automatically declaring another process dead is unsafe across containers, PIDs, remote mounts, and restarted machines. v0.1 requires the operator to verify that no writer remains before clearing the lock.
