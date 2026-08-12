# Security Policy

## Reporting a vulnerability

Please do not open a public issue for a vulnerability that could enable arbitrary command execution, credential exposure, lock bypass, unsafe repository mutation, or unauthorized promotion/merge.

Use GitHub's private vulnerability reporting / Security Advisories for this repository when available. If private reporting is temporarily unavailable, open a minimal public issue asking the maintainer for a private contact channel without including exploit details, credentials, or a working proof of concept.

## Scope

Maintainer Autopilot executes configured local commands. Treat configuration and repository scripts as trusted code. Keep production credentials out of agent-visible workspaces where possible, use least-privilege credentials, and separate untrusted code execution from credentials capable of pushing or merging.
