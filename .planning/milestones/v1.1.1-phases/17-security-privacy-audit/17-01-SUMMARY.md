---
phase: 17-security-privacy-audit
plan: 01
subsystem: security-privacy
tags: [security, privacy, loopback, redaction, installer]
requires: [SEC-01, SEC-02]
provides: [runtime-loopback-assertion, nested-lifecycle-redaction-coverage]
affects: [phase-17-validation]
tech-stack:
  added: []
  patterns: [runtime listener assertion, structural allowlist regression]
key-files:
  created: [.planning/phases/17-security-privacy-audit/17-01-SUMMARY.md]
  modified: [test/server.test.js, test/round-lifecycle.test.js]
decisions:
  - Preserve existing production behavior and existing installer assertions; add only the two confirmed coverage gaps.
metrics:
  duration: 8m
  completed: 2026-07-18
status: complete
---

# Phase 17 Plan 01: Security and Privacy Audit Summary

Runtime loopback binding and nested lifecycle redaction are now directly asserted without changing application behavior.

## Completed Tasks

### Task 1: Close only confirmed runtime and privacy assertion gaps

- Added an assertion against the started server's actual `address().address`.
- Added a nested synthetic fixture proving lifecycle output remains an allowlisted projection and excludes question, answer, token, secret, command, and absolute-path values.
- Existing bridge ownership, stale selector, revision, lifecycle, settings, host-output, and evidence assertions were retained because the audit confirmed they already cover the requested behavior.

### Task 2: Close only confirmed installer and malformed-config scope gaps

- No test or source change was needed. Existing isolated-root tests cover Claude/Codex target isolation, unrelated configuration preservation, conflict-before-already behavior, repeated uninstall, and missing-binary fail-closed results.

## Verification

- `node --test test/server.test.js test/bridge.test.js test/round-store.test.js test/round-lifecycle.test.js test/fake-host-conformance.test.js test/host-evidence-matrix.test.js test/cross-platform-evidence.test.js` — PASS, 102 tests.
- `node --test test/install.test.js test/cli-adapters.test.js test/shell-lifecycle.test.js test/host-install-gates.test.js` — PASS, 24 tests.
- Redaction/promotion suite — PASS, 13 tests.
- Package boundary/release gates — PASS, 6 tests.
- `bash -n install.sh uninstall.sh reinstall.sh` — PASS.
- ShellCheck — PASS (available locally).
- Protected-file hashes for `.planning/config.json` and `.planning/ui-reviews/.gitignore` remained unchanged; neither was touched or staged.

## Existing Coverage Preserved

The audit found direct existing coverage for current-round identity and capability ownership, request-id/round-id selection, draft/ack/recovery revisions, stale answer/cancel paths, settings future-version and CAS behavior, lifecycle and evidence redaction, exact installer entry matching, conflict handling, scoped host roots, repeated removal, and unavailable-host gates. No app source, archives, `.planning/config.json`, `.planning/ui-reviews/.gitignore`, or `.playwright-cli` files were changed.

## Deviations from Plan

None — only the two concrete gaps identified by the research were covered.

## Known Stubs

None introduced by this plan.

## Threat Flags

None. The changes add test-only assertions and do not add a runtime trust-boundary surface.

## Self-Check: PASSED

- Summary file exists.
- Changed test files exist.
- Focused and safety verification commands passed.
- Protected-file snapshots are unchanged.
