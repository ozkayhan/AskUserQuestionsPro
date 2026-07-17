---
phase: 09-durable-round-store-recovery-api
reviewed: 2026-07-17T11:22:45Z
depth: deep
files_reviewed: 22
files_reviewed_list:
  - docs/api.md
  - docs/decisions.md
  - docs/evidence/phase-09-durable-recovery.md
  - lib/atomic-write.cjs
  - lib/bridge-client.mjs
  - lib/round-record.cjs
  - lib/round-store.cjs
  - mcp-server/askuserquestionspro-mcp.mjs
  - server/bridge.js
  - server/server.js
  - test/bridge-client.test.js
  - test/bridge.test.js
  - test/draft-writer.test.js
  - test/mcp-long-round.test.js
  - test/round-record.test.js
  - test/round-store.test.js
  - test/server.test.js
  - test/settings.test.js
  - web/app.js
  - web/draft-writer.js
  - web/index.html
  - web/live.js
findings:
  critical: 2
  warning: 0
  info: 0
  total: 2
status: issues_found
---

# Phase 09: Final Code Review Report

**Reviewed:** 2026-07-17T11:22:45Z
**Depth:** deep
**Files Reviewed:** 22
**Status:** issues_found

## Summary

The reconnecting restart defect from the prior review is fixed: hydration now
marks `drafting`, `detached`, and `reconnecting` records as resumable, and the
new bridge regression completes detach → resume → restart → resume → answer.
The stale-lock *takeover race* is also removed because existing locks are no
longer unlinked automatically.

However, the replacement draft writer does not guarantee delivery before a
browser navigation, and the replacement lock behavior turns any crash-created
lock into a permanent write outage with no in-product recovery. Both violate
the phase's durable-recovery contract. The focused suite passes, but its draft
test observes only synchronous invocation of `fetch`, not successful delivery
across page teardown, and its lock test asserts the permanent failure.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Immediate navigation can still discard the latest draft

**Classification:** BLOCKER

**File:** `web/live.js:120-128`, `web/draft-writer.js:14-30`, `web/app.js:80-90`

**Issue:** The new writer invokes `postDraft()` immediately, but that function
uses an ordinary `fetch` without `keepalive`, `sendBeacon`, or an unload flush.
When a user refreshes or closes the page immediately after editing, the browser
may cancel the in-flight request during document teardown. The queued draft has
already been removed at `web/draft-writer.js:16-18`, so the next page instance
has no way to resend it. `test/draft-writer.test.js:24-29` only substitutes a
synchronous successful `save`; it cannot prove delivery after a real reload.
This leaves prior finding CR-02 unfixed for the interruption it was meant to
cover.

**Fix:** Keep an acknowledged local draft until the server returns its revision,
then flush it through an unload-safe transport (with payload-size handling), or
persist client-side and replay it after the next connection. Add a browser or
integration test that performs an edit, terminates the page/request before the
server receives it, reloads, and verifies the edit is eventually durably saved.

### CR-02: A crashed writer permanently disables persistence

**Classification:** BLOCKER

**File:** `lib/atomic-write.cjs:12-24`, `lib/atomic-write.cjs:41-46`

**Issue:** Removing automatic stale-lock stealing prevents the previous
check-then-unlink race, but a process that exits after line 16 and before
`releaseLock()` leaves `<target>.lock` behind forever. Every later
`writeFileAtomic()` call fails at lines 43-46. There is no lock-recovery command
or startup recovery path in the production callers (`lib/round-store.cjs` and
`lib/settings.js`). Consequently a bridge restart can read an unfinished round
but cannot save a draft, final answer, delivery acknowledgement, or expiry
transition; the test at `test/settings.test.js:443-455` explicitly codifies
this permanent failure as the expected behavior.

**Fix:** Provide an ownership-safe stale-lock recovery protocol plus a supported
operator/CLI recovery path, and make callers surface a distinct recoverable-lock
error. Add a crash simulation that leaves a lock, restarts the bridge, recovers
the lock safely, and completes a draft/final-answer write without permitting a
live owner to be displaced.

---

## Verification Performed

- Read the previous Phase 9 reviews and `09-REVIEW-FIX.md`, then traced the
  persistence, bridge recovery, browser draft, and lock call chains in the
  current tree at `b41557a`.
- Passed: `node --test test/round-record.test.js test/round-store.test.js test/bridge.test.js test/server.test.js test/settings.test.js test/bridge-client.test.js test/mcp-long-round.test.js test/draft-writer.test.js` — 143 passed, 0 failed.
- Confirmed fixed: prior CR-01 reconnecting restart and the destructive
  stale-lock takeover race. Prior CR-02 remains open as CR-01 above.

_Reviewed: 2026-07-17T11:22:45Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
