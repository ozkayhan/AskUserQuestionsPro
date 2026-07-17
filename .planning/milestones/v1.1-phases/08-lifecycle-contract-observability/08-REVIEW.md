---
phase: 08-lifecycle-contract-observability
reviewed: 2026-07-17T00:00:00Z
depth: deep
files_reviewed: 19
files_reviewed_list:
  - docs/api.md
  - docs/decisions.md
  - docs/evidence/phase-08-lifecycle-acceptance.md
  - docs/timeout-runbook.md
  - hooks/askuserquestionspro-bridge.mjs
  - lib/bridge-client.mjs
  - lib/round-lifecycle.cjs
  - lib/round-state.cjs
  - mcp-server/askuserquestionspro-mcp.mjs
  - server/bridge.js
  - server/server.js
  - test/bridge-client.test.js
  - test/bridge.test.js
  - test/mcp-long-round.test.js
  - test/round-lifecycle.test.js
  - test/round-state.test.js
  - test/server.test.js
  - web/app.js
  - web/live.js
findings:
  critical: 2
  warning: 3
  info: 0
  total: 5
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-07-17T00:00:00Z
**Depth:** deep
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Reviewed the complete Phase 8 commit range (`b859144..46037bf`) and traced the lifecycle through bridge state, HTTP/SSE, browser transport, hook, and MCP resume paths. The detached-round flow is not shippable: browser answers are rejected after host detachment, and the advertised delivery outcomes are recorded before delivery is attempted. The full test suite also fails in the affected MCP recovery coverage (400 passed, 2 failed).

## Critical Issues

### CR-01: Detached rounds reject the browser answer that recovery is meant to preserve

**Classification:** BLOCKER

**File:** `lib/round-state.cjs:27`, `server/bridge.js:94-98`

**Issue:** `detach` moves a round from `drafting` to `detached`, but `detached` has no `answerAccepted` transition. Consequently, a browser submission with the correct id and capability reaches `Bridge.provideAnswers()`, fails `_transition(..., 'answerAccepted')`, and the server returns `409 ownership_conflict`. This is the normal case when a host timeout/EOF occurs before the user has finished the form, so the user cannot submit answers until a separate host process happens to call `/resume` first. It violates the stated recoverable-long-round contract and reproduces in `test/mcp-long-round.test.js`'s EOF-resume flow.

**Fix:** Permit `answerAccepted` from `detached` (and keep the existing `reconnecting` transition), then add a deterministic regression that detaches a request-id round, posts a correct-capability answer before any resume request, and verifies both `200` and a later `/resume` result.

```js
detached: {
  resume: 'reconnecting',
  answerAccepted: 'delivery-pending',
  expire: 'expired',
  cancel: 'cancelled',
  recoveryError: 'recovery-error',
},
```

### CR-02: Lifecycle reports `delivered` before the host response is written

**Classification:** BLOCKER

**File:** `server/bridge.js:97-105`, `server/server.js:256-260`

**Issue:** `provideAnswers()` immediately transitions `delivery-pending` to `delivered`, deletes `_pending`, and resolves host waiters. The HTTP handler only attempts `sendJson(res, 200, { answers })` afterwards; it may instead return because the response is already destroyed/not writable. Thus a lost host response is recorded as `delivered`, while `delivery-uncertain` is unreachable from every production call site. The lifecycle contract and diagnostics therefore falsely claim successful delivery precisely in the delivery-loss race Phase 8 introduced state for.

**Fix:** Keep the round in `delivery-pending` until the response-write outcome is known. On a close/write failure, transition to `delivery-uncertain` and retain the request-id result for resume; transition to `delivered` only after the response completion path. Add an integration test that closes the `/resume` response just before answer submission and asserts `delivery-uncertain` plus successful later recovery.

## Warnings

### WR-01: Published HTTP contract still describes the pre-capability API

**Classification:** WARNING

**File:** `docs/api.md:16-21`, `docs/api.md:70-85`, `docs/api.md:106`

**Issue:** The prose at line 9 says capability is required, but the endpoint table and answer example still document `{ id, answers }`, call the conflict `stale_round`, and omit the capability requirement for `/cancel`. The implementation requires `capability` for both mutations and returns `ownership_conflict`. A client implemented from this maintained API reference will receive 400/409 responses and cannot complete a round.

**Fix:** Update both endpoint rows and the JSON example to include `capability`, document `ownership_conflict` for missing/stale/wrong credentials, and add an integrity assertion for the capability field and conflict reason.

### WR-02: Browser transport tests silently validate requests that production now rejects

**Classification:** WARNING

**File:** `test/live.test.js:17-27`, `test/live.test.js:59-70`

**Issue:** The Phase 8 tests call `postAnswers()` and `cancelRound()` without a capability and assert bodies that omit it. Their mocked fetch accepts the obsolete payload, so these tests pass while validating the exact request shape that `server/server.js` rejects. This removes regression protection for the new ownership boundary.

**Fix:** Pass a capability in each success-path call and assert it is serialized; add missing/wrong-capability tests against the real server route or a mock that returns `ownership_conflict`.

### WR-03: MCP recovery tests use timing sleeps instead of the required deterministic state boundary

**Classification:** WARNING

**File:** `test/mcp-long-round.test.js:253-260`, `test/mcp-long-round.test.js:411-417`

**Issue:** Both resume tests sleep for 30 ms and then submit the browser answer without waiting for the resumed waiter/lifecycle state. The full suite produced two `409` failures and a standalone run still fails the EOF case. Beyond exposing CR-01, this polling-by-delay makes recovery verification scheduling-dependent and contradicts Phase 8's deterministic deadline/race requirement.

**Fix:** Expose or observe a deterministic ready condition (for example, wait until `/current.lifecycle.state === 'reconnecting'` or until the resume request is registered) before posting the answer; cover the detached-before-resume case separately.

---

_Reviewed: 2026-07-17T00:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
