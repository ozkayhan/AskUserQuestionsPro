---
phase: 19-final-release-readiness-ship-gates
status: BLOCKED
candidate_sha: 5db6be8b1b188df69888188ea869cb36bf3ce286
date: 2026-07-18
---

# v1.1.1 Release Decision

Decision: BLOCKED.

The locally executable release and disposable macOS installer evidence is retained in [19-RELEASE-GATES.md](19-RELEASE-GATES.md) and [19-INSTALLER-MATRIX.md](19-INSTALLER-MATRIX.md). The final candidate gate manifest passes the full unit/integration suite, dedicated browser CLI evidence, lint, format, audit, shell, package-boundary, documentation, security, and installer checks. Shipment remains blocked only by the explicit package-version decision and unavailable external lanes.

## Version checkpoint

- `package.json`: `1.1.0`
- milestone target: `v1.1.1`
- `package-lock.json`: currently aligned with `1.1.0`
- decision: release owner must choose whether this release remains package `1.1.0` or authorize a separate versioning/changeset update to `1.1.1`.

No version field, lockfile, changeset, tag, registry publication, or release promotion was changed by this phase.

## External handoffs

| lane | status | owner | environment | reason | next evidence command |
|---|---|---|---|---|---|
| authenticated-claude | UNAVAILABLE | host integration owner | authenticated Claude Code session | no authenticated Claude executable/session in this workspace | run version-pinned long-round submit/wait/answer/ack/close acceptance |
| authenticated-codex | UNAVAILABLE | host integration owner | authenticated Codex session | no authenticated Codex session in this workspace | run version-pinned long-round submit/wait/answer/ack/close acceptance |
| native-windows | UNAVAILABLE | release platform owner | native Windows | no Windows environment in this workspace | run installer and recovery matrix on supported Windows |
| native-linux | UNAVAILABLE | release platform owner | native Linux | no Linux environment in this workspace | run installer and recovery matrix on supported Linux |

These lanes cannot promote capability status. Fake hosts, local protocol tests, macOS fixture tests, and source contracts are not equivalent to authenticated host or native OS evidence.

## Preservation

The operator’s pre-existing `.planning/config.json` and `.planning/ui-reviews/.gitignore` changes remain outside the release candidate and were not staged, reset, cleaned, or overwritten. v1.1 archive paths remain immutable against baseline `7f87a92`.
