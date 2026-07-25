---
quick_id: 260725-tkh
status: in_progress
---

# Modernization and Refactor — Passes 0–5

## Goal

Reduce backend structural complexity without changing the supported HTTP, MCP,
hook, CLI, settings, package, or browser-loading contracts.

## Scope

1. Record a parity contract, correct durable-round documentation, and add a
   focused manifest regression.
2. Remove only reference-proven private dead code.
3. Extract generic HTTP I/O helpers with characterization coverage.
4. Split settings and round/recovery routes while preserving composition,
   response payloads, and route order.
5. Centralize Bridge transition decisions only where the existing lifecycle
   behavior can be preserved.

## Deferred Decision

The discovered expiry/state-machine contradiction is deliberately excluded from
implementation until a separate Turkish decision brief is approved. The user
selected C: preserve the existing behavior for resumed `reconnecting` rounds,
whose expiry callback must not close the round or reject its pending waiter;
this supports multi-day rounds. No change in this task may alter detached or
drafting expiry policy, add retention settings, or unify durable/in-memory
transition behavior.

## Verification

- Focused regression tests for every extracted seam.
- `npm test`, `npm run lint`, `npm run format:check`, ShellCheck, and
  `npm pack --dry-run` before handoff.
