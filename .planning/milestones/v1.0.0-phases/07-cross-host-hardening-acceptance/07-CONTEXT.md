# Phase 7 Context

## Goal

Close the remaining host-boundary gap with evidence from real Codex and local
Claude-compatible MCP flows, then leave one documented lifecycle contract for
future changes.

## Verified constraints

- `server.requestTimeout = 0` is necessary but cannot override a host-owned MCP
  deadline.
- Codex CLI 0.144.4 reproduced a hard MCP disconnect at `300991ms` even with
  `tool_timeout_sec = 3600` in its registration.
- A requestId-bearing round must survive that disconnect without allowing
  unbounded orphan state; explicit cancellation must remain terminal.
- The bridge remains localhost-only, single-flight, in-memory, and Node 18+
  compatible.

## Scope

1. Add bounded detach/resume ownership to the bridge/server/client and expose a
   host-neutral MCP `resume` tool.
2. Preserve explicit MCP cancellation by sending `/cancel` before closing the
   owner stream.
3. Verify the real Codex CLI flow at the observed 300-second boundary and verify
   a fresh MCP process can recover the exact browser-submitted answer.
4. Document the Codex finding, Claude fallback, lifecycle events, endpoint
   contracts, and operational runbook.
5. Run full automated and release-quality gates; do not claim an unmeasured
   Claude-specific deadline has been eliminated.

## Out of scope

- Remote persistence, multi-user sessions, authentication, or durable tickets
  across bridge process restarts.
- Changing the host's own hard deadline or inventing MCP progress tokens.

## Acceptance evidence

- `test/mcp-long-round.test.js`: real MCP stdio + HTTP round and detached/resume
  process boundary.
- Live Codex CLI smoke: lifecycle `host_detached` at `elapsedMs: 300991`, then a
  fresh Codex `resume` call returned all 15 answers and completed the round.
- `npm test`: 396 tests, 396 passing.
- `npm run lint`, `npm run format:check`, and `git diff --check`: passing.
