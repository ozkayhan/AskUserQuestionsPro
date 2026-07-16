---
status: passed
---

# Phase 7 Verification

## Automated

- `npm test` — 396 tests passing, 0 failing.
- `npm run lint` — passing.
- `npm run format:check` — passing.
- `git diff --check` — passing.
- `node --test test/mcp-long-round.test.js` — delayed 15-question MCP round and
  detached/resume process boundary passing.

## Host boundary

- Codex CLI 0.144.4 was run against the current checkout with a 15-question
  `ask` call. The host closed the MCP stream at `300991ms`, matching the
  previously observed five-minute symptom. The bridge logged `host_detached`,
  kept the round pending, and a fresh Codex process called `resume` and received
  all 15 answers.
- Claude Code's hook adapter was run directly with 15 questions and a delayed
  answer. It returned a valid `PreToolUse` allow payload. A full Claude model
  session could not be executed because `claude -p` reported `Not logged in`;
  this is recorded as an environment authentication limitation, not silently
  treated as a timeout result.

## Acceptance interpretation

The local browser/server round is no longer destroyed by the known Codex host
deadline. Explicit cancellation still terminates a round. Detached rounds are
bounded by the one-hour TTL and are recoverable only through the single-user
bridge's `resume` contract.
