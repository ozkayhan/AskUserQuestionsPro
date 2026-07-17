---
phase: 10-settings-v2
reviewed: 2026-07-17T00:00:00Z
depth: deep
files_reviewed: 13
files_reviewed_list:
  - bin/cli.js
  - hooks/askuserquestionspro-bridge.mjs
  - lib/bridge-client.mjs
  - lib/round-lifecycle.cjs
  - lib/runtime-settings.cjs
  - lib/settings.js
  - mcp-server/askuserquestionspro-mcp.mjs
  - server/bridge.js
  - server/server.js
  - web/styles.css
  - test/browser-settings-e2e.test.js
  - test/runtime-settings.test.js
  - test/settings.test.js
findings:
  critical: 1
  warning: 1
  info: 0
  total: 2
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-07-17
**Depth:** deep
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Reviewed the follow-up commits `b3cd935`, `440cdde`, `8a21853`, and `9fc6b2e`, plus their direct Phase 10 source and test dependencies. CR-01 now has adapter and diagnostics hooks, and WR-01 uses a non-mutating doctor inspection. The modal has a viewport-independent scroll constraint. The browser test performs several real interactions and no longer removes successful artifacts.

The phase is not clean: `delivery.mode: confirm` is wired to suppress delivery acknowledgement, but no acknowledgement operation exists. A successful host response is therefore persisted as uncertain and remains recoverable until expiry. The browser evidence remains incomplete for the behaviors it claims to cover.

## Critical Issues

### CR-01: Confirm delivery mode strands every successfully delivered round

**File:** `server/server.js:400-401`, `server/server.js:461-462`
**Issue:** When `delivery.mode` is `confirm`, `delivery.requiresAcknowledgement` is true, so both `/ask` and `/resume` skip `bridge.confirmDelivery()` even after `sendJsonAndObserve()` reports a successful response. They unconditionally call `markDeliveryUncertain()` instead. There is no HTTP/MCP acknowledgement endpoint or subsequent host acknowledgement call in the reviewed code. Thus enabling the advertised setting turns every successful delivery into an uncertain/recoverable result until the detached-round TTL, and can leave durable records/recovery state behind for normal completed rounds.
**Fix:** Implement an explicit, capability-protected acknowledgement flow and invoke it from the owning host after it has accepted the result, or make `confirm` actually wait for and validate that acknowledgement. Do not mark a response uncertain when the transport has already finished successfully unless the contract explicitly requires a later acknowledgement; add an integration test with `delivery.mode: confirm` asserting terminal `delivered` state and cleanup.

## Warnings

### WR-01: Browser evidence still records claims that are not asserted

**File:** `test/browser-settings-e2e.test.js:26-47`
**Issue:** The Playwright test now genuinely checks modal visibility, initial focus, one-tab containment, Escape focus return, persistence, future-version rejection, and narrow document width, and it preserves screenshots/logs on successful runs. However, the evidence log still collapses untested scenarios into a single PASS claim: it does not verify a complete focus loop, keyboard event isolation, contrast/high-contrast rendering, reduced-motion computed styles, import validation/rollback, or the 320px modal's own scrollability. It also skips entirely when the Playwright Node package is absent (as shown by this run), so the required browser assertions are not part of the normal `npm test` result in this environment.
**Fix:** Add direct assertions for each retained evidence row (including modal scroll dimensions and computed motion/contrast styles), exercise import failure with state rollback, and preserve artifacts in a failure-safe `t.after`/diagnostic path. Make the browser dependency available in the project’s verification environment or expose a separate required browser-test command so a skipped test cannot be treated as completed browser verification.

## Verification

- `npm test` — passed: 451 tests, 1 skipped (Playwright Node package unavailable; browser evidence did not run).
- `git diff --check b3cd935^..9fc6b2e` — passed.
- Modal scroll fix inspected in `web/styles.css`: `.settings` now has `max-height: calc(100vh - 32px)` and `overflow-y: auto` outside the mobile media query.
- Doctor read-only path inspected: `bin/cli.js` passes `Settings.inspectReadOnly()` and the regression test verifies legacy settings and backup remain unchanged.
- Runtime owner hooks inspected: Claude/Codex adapter gates and diagnostics redaction are consumed, but confirm delivery remains incomplete as reported above.

---

_Reviewed: 2026-07-17_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
