# Dogfooding Maintainer Autopilot

Maintainer Autopilot should be able to maintain its own repository. The public project history is part of the product: issues should map to one task lineage, implementation should be verified deterministically, repairs should reuse the same lineage and PR, and successful work should end at a clean checkpoint.

## Recommended public workflow

1. Open a narrowly scoped GitHub issue with acceptance criteria.
2. Run the issue through Maintainer Autopilot locally or on a trusted runner.
3. Inspect the generated candidate and deterministic gate results.
4. Promote to a task branch and one pull request.
5. Let GitHub Actions run independently.
6. If CI fails, repair the same lineage and update the same PR.
7. Merge only after review and CI pass.
8. Record the merged state as `CHECKPOINTED`.

## Evidence worth preserving

For each meaningful maintenance task, keep the issue, pull request, CI result, candidate receipt, and release note. These artifacts make the maintenance process inspectable without publishing private product repositories or credentials.
