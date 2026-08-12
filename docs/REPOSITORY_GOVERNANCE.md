# Repository governance

This repository protects `main` with a repository ruleset named `protect-main`.
The policy is part of the project's safety model: Maintainer Autopilot should improve a repository through normal branches, pull requests, deterministic checks, and explicit merge decisions rather than by writing directly to the authoritative branch.

## Protected-main policy

The active ruleset targets the default branch and currently enforces:

- branch deletion is blocked;
- non-fast-forward updates / force pushes are blocked;
- changes must arrive through a pull request;
- required approving reviews are `0` while the project has a single maintainer;
- all review conversations must be resolved before merge;
- the `test` GitHub Actions status check must pass;
- required status checks use strict mode, so the PR branch must be up to date with the target branch before merge;
- no user, role, team, or app is on the bypass list.

The repository currently allows GitHub's merge, squash, and rebase methods. Maintainer Autopilot keeps automatic merge disabled by default; a successful CI run is necessary but is not itself permission to bypass the repository's merge policy.

## Why approvals are currently zero

A one-person open-source project cannot obtain an independent maintainer approval on every PR without creating a fake review process. The project therefore requires the PR boundary, deterministic CI, and resolved conversations, but keeps the approval count at zero until another trusted maintainer joins.

When the maintainer team grows, the preferred next step is to require at least one approval for safety-sensitive or all changes and, if useful, introduce CODEOWNERS for high-risk surfaces.

## Contributor workflow

1. Start from an up-to-date `main`.
2. Create a focused branch for one issue/task lineage.
3. Make the smallest scoped change and add appropriate tests.
4. Run `npm run check` locally.
5. Open a pull request to `main`.
6. Wait for the required `test` check to pass and update the branch if `main` moved.
7. Resolve review conversations before merge.
8. Merge through GitHub; do not force-push or write directly to `main`.

For an Autopilot task, the same policy applies: implementation and repairs stay on the recorded task branch/lineage, promotion reuses the same PR, and checkpoint happens only after the PR is actually merged.

## Policy vs. UI

This document records the durable policy, not click-by-click GitHub screenshots. GitHub's settings UI changes over time; the invariants above are what contributors and automation should rely on.

Any change that weakens the protected-main policy should be proposed in a dedicated issue and pull request with an explicit safety rationale.
