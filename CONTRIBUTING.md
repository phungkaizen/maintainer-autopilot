# Contributing

Thanks for helping improve Maintainer Autopilot.

## Development

```bash
npm install
npm run check
```

## Pull requests

Keep changes focused. Add tests for lifecycle, locking, recovery, or safety behavior. Do not weaken the single-writer invariant or make automatic merge the default.

All changes to `main` follow the protected-branch policy in [docs/REPOSITORY_GOVERNANCE.md](docs/REPOSITORY_GOVERNANCE.md): use a pull request, keep the branch up to date, pass the required `test` check, and resolve review conversations before merge.

For security-sensitive changes, explain the trust-boundary impact in the PR description.
