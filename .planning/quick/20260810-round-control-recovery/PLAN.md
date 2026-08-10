---
status: complete
created: 2026-08-10
---

# Round control and recovery quick task

## Objective

Make long AskUserQuestionsPro rounds operable from the host when the MCP
connection drops or the user asks to stop/change an already-open round.

## Scope

- Add an exact-round `cancel_round` MCP control tool backed by a localhost
  durable cancel route.
- Preserve the existing detached/resume semantics and never guess a round by
  recency.
- Update the installed askpro skill and MCP instructions to preserve the
  user's language and to cancel before re-asking when the current round is
  wrong or stale.
- Add integration coverage for discovery → exact cancellation and tool
  metadata.

## Assumptions

- A user explicitly asking to stop or replace a round authorizes cancellation
  of that exact active round.
- A round that already has an answer awaiting delivery is not silently
  discarded by this new control path.
- Host-side hard deadlines remain outside the bridge; resume remains the
  recovery path after an unavoidable host disconnect.

## Verification

- Focused MCP/HTTP regression tests.
- `npm test`, `npm run lint`, `npm run format:check`, and `git diff --check`.
