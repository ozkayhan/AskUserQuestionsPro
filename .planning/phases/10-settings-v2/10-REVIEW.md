---
phase: 10-settings-v2
reviewed: 2026-07-17T00:00:00Z
depth: deep
files_reviewed: 13
files_reviewed_list:
  - bin/cli.js
  - lib/bridge-client.mjs
  - lib/round-lifecycle.cjs
  - lib/settings.js
  - server/server.js
  - web/app.js
  - web/draft-writer.js
  - web/settings-panel.js
  - web/settings-schema.js
  - web/styles.css
  - test/browser-settings-e2e.test.js
  - test/frontend-settings-evidence.md
  - test/runtime-settings.test.js
findings:
  critical: 2
  warning: 1
  info: 0
  total: 3
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-07-17
**Depth:** deep
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Reviewed the implementation and tests changed by gap-closure commits `23932bd`, `c06da18`, `421eeb8`, `abf984b`, and `94ab1d8`, plus their direct settings/runtime dependencies. The migration backup path and redacted doctor projection were inspected, as were preview/apply validation and browser focus/UI changes.

The implementation still has two blocker-level correctness gaps: runtime settings advertised by the matrix do not reach their owners, and the browser evidence test writes unconditional PASS claims instead of verifying the claimed behavior. One warning remains because `doctor` can unexpectedly rewrite a legacy settings file through `inspect()`.

## Critical Issues

### CR-01: Runtime settings matrix fields are not consumed by their declared owners

**Classification:** BLOCKER
**File:** `web/settings-schema.js:417-430`, `lib/round-lifecycle.cjs:54-58`
**Issue:** The runtime matrix declares `delivery.mode`, `delivery.retryMs`, `closure.mode`, `adapters.claudeEnabled`, and `adapters.codexEnabled` as importable/exportable runtime settings with owners, but the reviewed runtime code has no consumers for them. The diagnostics consumer is also ineffective: `createLifecycle()` reads `inspected.effective.diagnostics` into `settings` and then never consults it before emitting events. Consequently, importing or setting these values reports success while behavior remains unchanged, violating the settings contract and creating misleading operational controls.
**Fix:** Either implement and call the declared owner hooks on every relevant runtime path (including using diagnostics to gate/redact emission and delivery/closure/adapter settings in their respective flows), or remove these fields from the import/export matrix until they are functional. Add behavior tests that change each field and assert the corresponding runtime outcome.

### CR-02: Browser evidence test fabricates behavioral PASS results

**Classification:** BLOCKER
**File:** `test/browser-settings-e2e.test.js:27-33`
**Issue:** After checking only that two screenshots can be taken, the test unconditionally writes `keyboard isolation: PASS`, focus trapping, persistence, contrast, reduced-motion, and other PASS rows. It does not interact with the modal, inspect focus/ARIA behavior, change or reload settings, test import validation/rollback, or assert CSS/viewport outcomes. It also removes the entire artifact directory in `finally`, so the documented screenshots and assertions log do not survive a successful run. This can make the phase appear manually/evidence-verified when the claimed scenarios were never tested.
**Fix:** Use a real browser automation harness to perform and assert each listed scenario (including keyboard event isolation, focus loop/return, persistence, future-version rejection, rollback, narrow layout, and reduced motion). Preserve artifacts on success and clean only stale artifacts before a run; do not overwrite the evidence document with generated unconditional PASS text.

## Warnings

### WR-01: Read-only doctor command can mutate legacy settings during inspection

**Classification:** WARNING
**File:** `lib/settings.js:60-83`, `bin/cli.js:537-546`
**Issue:** `doctor` calls `Settings.doctorProjection()`, which defaults to `inspect()`. `inspect()` invokes `migrateLegacy()`, creates a backup, and atomically rewrites the settings file whenever it sees a legacy document. Thus a diagnostic command advertised as reporting state can perform migration writes (and can report a migration failure after logging a write error), which is surprising for read-only diagnostics and expands the write surface during troubleshooting.
**Fix:** Separate pure inspection from migration: make doctor use a non-mutating projection of the parsed legacy/default state, or add an explicit `migrate` operation and invoke migration only from startup/write flows with clear reporting. Test that doctor leaves both the settings file and backup unchanged.

## Verification

- `npm test` — passed, 450 tests.
- `git diff --check 23932bd^ 94ab1d8` — passed.

---

_Reviewed: 2026-07-17_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
