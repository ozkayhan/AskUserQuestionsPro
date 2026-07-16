# Reliability Refactor Architecture Research

**Date:** 2026-07-16

## Current Boundaries

1. Host adapters (`hooks/`, `mcp-server/`) translate host contracts and own caller cancellation/fallback.
2. `lib/bridge-client.mjs` starts the daemon, submits `/ask`, waits for registration, opens the browser, and maps aborts/errors.
3. `server/server.js` owns HTTP, SSE, static assets, settings injection, request disconnect handling, and route-level validation.
4. `server/bridge.js` owns single-flight round state and round identity.
5. `web/live.js` and `web/app.js` own SSE, browser interaction state, answer submission, navigation, and UI lifecycle.
6. `lib/question-contract.cjs`, `web/answer-map.js`, and settings schema are shared contract/pure-logic seams.

## Refactor Invariants

- A round has one stable correlation id, one bridge id, and one owner; every resolve/cancel path must verify ownership.
- Host transport lifecycle must not be conflated with browser round lifecycle. A dropped host connection should be observable and should either preserve a resumable round or cancel it deliberately according to an explicit policy.
- Boundary validation remains at HTTP/MCP edges and pure answer mapping remains independent of DOM.
- Browser reconnects must never submit answers for a stale round.
- Logging is structured and redacted; question text and answers are not required for diagnosing lifecycle failures.

## Safe Build Order

1. Add lifecycle observability and a reproducible test harness without changing behavior.
2. Establish explicit timeout/cancellation contracts and test each transport boundary.
3. Fix the Codex MCP lifecycle based on evidence; validate Claude separately.
4. Harden bridge/server ownership, disconnect, reconnect, and stale-round behavior.
5. Refactor browser state and accessibility seams while preserving pure answer contracts.
6. Audit CLI/installers/package/release paths and align tests.
7. Consolidate and verify documentation after the source contracts stabilize.

## Phase-Shaping Implications

- Diagnosis must precede architectural redesign because a host hard deadline and an application idle timeout require different fixes.
- If MCP progress notifications solve the failure, the change can stay at the MCP adapter boundary. If Codex imposes a hard wall-clock limit, a resumable/chunked protocol is a separate larger phase.
- Documentation cleanup should follow the contract audit so the maintained docs describe final behavior rather than intermediate assumptions.
- Runtime source changes should remain disjoint by ownership: transport/host, bridge/server, web state, and tooling/docs each need focused tests and commits.
