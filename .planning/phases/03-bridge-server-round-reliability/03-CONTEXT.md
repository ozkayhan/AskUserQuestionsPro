---
phase: 3
name: bridge-server-round-reliability
source: autonomous-context
created: 2026-07-16
---

# Phase 3 Context

## Intent

Turn the localhost round coordinator into an explicit, testable terminal-state
boundary. The previous phases proved long waits and host cancellation, but the
HTTP/bridge layer still relies on scattered strings and route-local assumptions.

## Evidence carried forward

- `Bridge` already protects answers and disconnects with a monotonic round id.
- The server already sets `requestTimeout = 0` and validates the `/answer` body,
  but its error responses do not consistently identify stale, concurrent, or
  terminal outcomes.
- `POST /ask` disconnect cleanup is covered once at the wire level; concurrent
  owner and stale-answer coverage is stronger in unit tests than in the public
  HTTP contract.
- Historical Contract R is durable: id ownership must be checked by answer and
  cancellation paths, and stale operations must be deterministic no-ops/409s.

## Decisions for this phase

1. Keep the single-flight, in-memory, localhost-only architecture. Do not add a
   queue or durable question/answer storage.
2. Normalize cancellation reasons at the bridge boundary and attach a typed
   terminal code to the rejected owner promise. Existing human-readable error
   messages remain intact.
3. Expose an explicit localhost `POST /cancel` operation for user/host/browser
   cancellation. It is id-owned, allowlisted, idempotent, and returns 409 for
   stale ownership.
4. Add machine-readable HTTP reason categories (`stale_round`,
   `round_in_progress`, and terminal reason codes) while preserving current
   status codes and successful payload shapes.
5. Strengthen tests around malformed cancellation, stale cancel/answer, owner
   disconnect, concurrent submit, and no pending-state leaks.

## Non-goals

- Multi-round queueing or cross-process persistence.
- Changing browser UX beyond the transport seam needed for later Phase 4.
- Replacing the bridge with a third-party state library.
