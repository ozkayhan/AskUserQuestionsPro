---
phase: 2
name: host-lifecycle-fix
source: autonomous-context
created: 2026-07-16
---

# Phase 2 Context

## Intent

Keep the host-side request alive while the user is intentionally completing a long browser round. Codex is the primary reported failure surface; Claude Code must use the same lifecycle contract or expose a host-specific, actionable fallback.

## Evidence carried from Phase 1

- The bridge application timeout is one hour and is not the first safe variable to change.
- The server and bridge now emit redacted lifecycle events, so host cancellation, browser disconnect, bridge cancellation, and application timeout can be separated.
- A deterministic 15-question idle round and stale-owner regression pass locally, but those tests do not exercise the real MCP stdio boundary.
- The installed Codex MCP registration reports `tool_timeout_sec: null`; this does not prove that no client-side deadline exists.
- MCP supports optional progress notifications when the caller supplies `_meta.progressToken`. The server can use this to signal that a tool call is still active without changing its final result contract.

## Decisions for this phase

1. Add a standards-shaped MCP progress heartbeat only for active requests that supplied a valid progress token. Do not invent a token, because notifications must be associated with the caller's active request.
2. Keep the heartbeat bounded, monotonic, and stopped in every completion, cancellation, and error path. It is a liveness signal, not a second timeout or a fake answer.
3. Preserve the existing one-hour bridge timeout and `notifications/cancelled` behavior. A host cancellation remains a typed terminal outcome and must not be rewritten as an application timeout.
4. Make error text distinguish host cancellation, application timeout, bridge failure, and bridge-unavailable startup so host-native fallback can act on the real cause.
5. Verify the actual child-process JSON-RPC wire using a local server and delayed answer; internal unit tests alone are insufficient.

## Non-goals

- Changing Codex or Claude user configuration globally without evidence.
- Adding a remote queue, multi-user persistence, or a resumable ticket protocol in v1.
- Claiming that progress heartbeats defeat a hard host wall-clock deadline before a real host run proves it.

## Plan split

- `02-01` owns the progress/typed-error implementation and focused unit tests.
- `02-02` owns real MCP stdio integration, cancellation/error behavior, Claude-path checks, and maintainer documentation of the verified boundary.
