---
phase: 19-browser-lifecycle-recovery-corrections
plan: 01
subsystem: api
tags: [node, http, sse, recovery, lifecycle, durable-rounds, settings]

# Dependency graph
requires:
  - phase: 18-release-readiness-and-ship-gates
    provides: Durable round persistence, exact-round ownership, acknowledgement, and redaction contracts.
provides:
  - Bridge-owned redacted recovery filtering for live drafting, detached, reconnecting, and delivery-uncertain rounds.
  - Exact durable deletion with pending/waiter rejection, timer cleanup, ownership cleanup, and snapshot invalidation.
  - Loopback HTTP deletion route with safe typed errors and post-delete SSE/current broadcast.
  - v2 closure default of after-delivery with explicit never preserved.
  - Maintained recovery and delivery API documentation.
affects: [19-02-browser-lifecycle, recovery-ui, browser-delivery, sse]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Bridge is the single recovery-policy chokepoint; HTTP exposes only its redacted metadata and exact selector result.
    - Durable deletion unlinks the exact private file before mutating the in-memory record map, then clears every matching runtime owner.
    - Completed-result expiry timers are explicitly tracked and cleared on acknowledgement or exact deletion.

key-files:
  created:
    - .planning/phases/19-browser-lifecycle-recovery-corrections/deferred-items.md
  modified:
    - lib/round-store.cjs
    - server/bridge.js
    - server/server.js
    - web/settings-schema.js
    - docs/api.md
    - test/bridge.test.js
    - test/server.test.js
    - test/settings-schema.test.js

key-decisions:
  - "GET /rounds is filtered at Bridge.listRecoverable() to non-expired drafting, detached, reconnecting, and delivery-uncertain records; delivered and other terminal records stay out of the chooser."
  - "POST /rounds/:roundId/delete is an exact path-only destructive boundary; it validates state and expiry before removing the private record and never accepts or returns capabilities or payloads."
  - "Delivery acknowledgement remains the only terminal-delivery boundary, while delivery-uncertain records remain retained until acknowledgement, expiry, or explicit exact deletion."
  - "The canonical v2 closure default is after-delivery; explicit never remains a valid no-close override."

patterns-established:
  - "Use stable round_deleted rejection codes for every waiter attached to an exactly deleted hydrated owner."
  - "Clear current ownership and broadcast a null lifecycle snapshot only after exact durable deletion succeeds."

requirements-completed: [REC-01, REC-02]

coverage:
  - id: D1
    description: "Bridge/store recovery policy returns only redacted live recoverable records and exactly deletes selected durable records with complete in-memory cleanup."
    requirement: REC-01
    verification:
      - kind: unit
        ref: "node --test test/bridge.test.js test/settings-schema.test.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "Loopback HTTP recovery discovery and exact deletion preserve redaction, typed errors, current ownership, and SSE null-state broadcasts."
    requirement: REC-02
    verification:
      - kind: integration
        ref: "node --test test/server.test.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "Canonical v2 closure settings default to after-delivery while explicit never remains valid and browser projection compatibility is preserved."
    verification:
      - kind: unit
        ref: "test/settings-schema.test.js#closure defaults to after-delivery while explicit never remains valid"
        status: pass
    human_judgment: false

# Metrics
duration: 21m
completed: 2026-07-19
status: complete
---

# Phase 19 Plan 01: Browser Lifecycle Recovery Corrections Summary

**Redacted exact-round recovery discovery and deletion over the loopback bridge, with complete runtime cleanup and after-delivery closure defaults**

## Performance

- **Duration:** 21 minutes
- **Started:** 2026-07-19T16:39:10Z
- **Completed:** 2026-07-19T16:59:54Z
- **Tasks:** 2 completed
- **Files modified:** 8 planned files, plus one deferred-items note

## Accomplishments

- Added `RoundStore.remove()` and authoritative Bridge recovery filtering for only non-expired, genuinely recoverable lifecycle states, preserving `Record.metadata()` redaction.
- Added exact deletion cleanup for hydrated pending rounds, waiters, detach/completed timers, delivery/completed ownership maps, current snapshots, and unrelated-round isolation.
- Added `POST /rounds/:roundId/delete`, typed malformed/missing/expired/non-recoverable errors, safe success responses, SSE/current invalidation, and API documentation for browser retirement, acknowledgement, uncertainty, and the three recovery actions.
- Changed v2 closure normalization to default to `after-delivery` while preserving explicit `never`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Make bridge recovery filtering and exact deletion authoritative** - `7e3feeb` (`feat`)
2. **Task 1 follow-up: Invalidate stale snapshot after exact deletion** - `8bbe7a4` (`fix`, Rule 1 auto-fix)
3. **Task 2: Expose exact deletion through HTTP and document the boundary** - `26ac964` (`feat`)

**Plan metadata:** final state/roadmap metadata commit follows after self-check and planning updates.

## Files Created/Modified

- `lib/round-store.cjs` - Exact private record removal primitive with file-first/map-second mutation.
- `server/bridge.js` - Recoverable-state policy, tracked completed timers, exact deletion cleanup, and snapshot invalidation.
- `server/server.js` - Path-only exact deletion route and successful-deletion lifecycle broadcast.
- `web/settings-schema.js` - `after-delivery` canonical closure default and matrix fallback.
- `docs/api.md` - Redacted recovery, deletion, delivery, retirement, and silent-reconnect contract.
- `test/bridge.test.js` - State filtering, redaction, exact deletion, expiry, rejection, timer, ownership, and stale-snapshot regressions.
- `test/server.test.js` - `/rounds`, deletion errors, redaction, `/current`, SSE, delivered exclusion, uncertain retention, and unrelated-record regressions.
- `test/settings-schema.test.js` - Closure default, explicit override, invalid fallback, and browser projection regression.
- `.planning/phases/19-browser-lifecycle-recovery-corrections/deferred-items.md` - Out-of-scope pre-existing docs-integrity failure record.

## Decisions Made

- Recovery policy remains bridge-owned so browser consumers cannot accidentally re-admit delivered or terminal records.
- Deletion is exact-round and path-only; `/cancel` remains the numeric active-round ownership operation.
- Delivery uncertainty is retained and recoverable until acknowledgement, expiry, or explicit exact deletion.
- No new dependency, database, authentication layer, remote binding, or payload-bearing recovery surface was introduced.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cleared stale previous lifecycle snapshot when deleting the current hydrated owner**
- **Found during:** Task 2 HTTP SSE/current regression
- **Issue:** After `_pending` was deleted, `getSnapshot()` could fall back to a previously delivered round’s `_lastSnapshot`, violating the required empty `/current` and SSE state.
- **Fix:** Marked deletion of the matching pending owner as current invalidation and added a focused bridge regression.
- **Files modified:** `server/bridge.js`, `test/bridge.test.js`
- **Verification:** Bridge and server suites pass; regression asserts `getSnapshot() === null` after deletion.
- **Committed in:** `8bbe7a4`

**Total deviations:** 1 auto-fixed (Rule 1: 1)
**Impact on plan:** Necessary correctness fix within the planned bridge deletion cleanup; no architectural or scope expansion.

## Issues Encountered

- `npm test` reports one pre-existing failure in `test/docs-integrity.test.js` because the untouched historical link in `docs/evidence/v1.1.1-release-handoff.md` targets missing Phase 16 verification evidence. The failure is recorded in `deferred-items.md`; changing historical evidence was outside this plan.
- Full-suite result: 508 passed, 1 failed, 1 skipped. Focused bridge/settings/server suites passed. `npm run lint`, `npm run format:check`, and `npm audit --audit-level=high` passed with zero vulnerabilities.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 19-02 can consume the stable `/rounds` redacted metadata, exact deletion route, acknowledgement/uncertainty semantics, and after-delivery closure default. No browser/UI files from 19-02 were implemented here.

---
*Phase: 19-browser-lifecycle-recovery-corrections*
*Plan: 01*
*Completed: 2026-07-19*

## Self-Check: PASSED

- Summary and deferred-items artifacts exist on disk.
- Task commits `7e3feeb`, `8bbe7a4`, and `26ac964` exist in git history.
- Stub scan found no placeholder or unwired implementation in the plan’s changed production surfaces.
- The new deletion endpoint and private-store mutation are covered by the plan threat model; no additional unplanned trust boundary was introduced.
