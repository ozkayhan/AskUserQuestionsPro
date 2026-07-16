---
phase: 4
name: browser-state-recovery
source: autonomous-context
created: 2026-07-16
---

# Phase 4 Context

## Intent

Make the browser a round-aware client rather than a passive SSE renderer. A
long-lived page must preserve answer state across transport reconnects, report
the difference between network loss and a stale/terminal round, and keep its
keyboard/focus/ARIA contract intact.

## Evidence carried forward

- The React flow remounts on round id, which prevents old answers crossing into
  a new round.
- SSE reconnect uses exponential full jitter, but connection callbacks are not
  generation-scoped and duplicate reconnect callbacks can race.
- `postAnswers()` marks all HTTP failures as a generic server error, so the new
  `stale_round` and terminal reason categories are not surfaced to the UI.
- The browser currently logs malformed SSE payload contents and has a duplicate
  sidebar prop; both are maintenance/privacy smells.
- Existing accessibility tests are structural and cover many controls, but the
  live error/recovery semantics and grouped sidebar identity are not fully
  asserted.

## Decisions for this phase

1. Treat the monotonic server round id as the browser state boundary. Same-id
   snapshots do not reset local answers; a new id remounts the flow.
2. Give each EventSource connection a generation token. Only the active
   connection may schedule reconnects or reset backoff.
3. Parse HTTP error bodies into typed `reason`/`roundId` fields and classify
   `stale_round`, `round_in_progress`, network failure, and server failure
   separately. Never retry a stale round as if it were a network outage.
4. Keep browser storage out of scope for v1; persistence across a full page
   reload would require a privacy and stale-answer policy not yet approved.
5. Preserve zero runtime dependencies and the existing vendored React/Babel
   browser architecture.

## Non-goals

- A full browser automation dependency or build-system migration.
- Persisting answers to localStorage or a remote service.
- Changing question types or keyboard meanings.
