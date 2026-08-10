---
status: complete
completed: 2026-08-10
---

# Round control and recovery summary

Implemented an exact-round `cancel_round` MCP control path backed by
`POST /rounds/:roundId/cancel`. It cancels only active drafting, detached, or
reconnecting rounds, preserves delivery-uncertain results, and is covered by
bridge and real MCP stdio integration tests.

Updated the askpro skill, MCP initialization guidance, README, API docs, and
timeout runbook to preserve the user's language, cancel before replacing an
immutable active round, and verify that the host points at the upgraded MCP
installation.

Verification:

- `npm test`: 535 passed, 1 skipped (optional Playwright dependency)
- `npm run lint`: passed
- `npm run format:check`: passed
- `git diff --check`: passed
- Focused bridge/MCP/routes suite: 36 passed

External gap: the live Codex and Claude registrations on this Mac still point
at `/Users/oka/.local/lib/node_modules/askuserquestionspro` and must be updated
by installing this package version before manual host UAT.
