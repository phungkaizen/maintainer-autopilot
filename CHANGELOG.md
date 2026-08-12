# Changelog

## 0.1.0 - 2026-08-12

Public beta release. This is the first supported baseline for trying Maintainer Autopilot on a local Git repository.

- Initial local-first CLI.
- Persistent task state and transition history.
- Atomic single-writer workspace lock.
- Configurable implementation/review agent commands.
- Codex-safe defaults using workspace-write for implementation and read-only for review.
- Sequential deterministic finalizer gates.
- Explicit repair lineage.
- Optional GitHub CLI PR/check/merge adapter with auto-merge disabled by default.
- Clean-install quickstart and explicit v0.1 operating limitations.
