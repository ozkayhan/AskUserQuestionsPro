---
phase: 19-browser-lifecycle-recovery-corrections
plan: 01
subsystem: browser-lifecycle
tags: [browser, recovery, sse, delivery, regression-tests]
requires:
  - phase: 18
    provides: v1.1.1 release-hardening baseline and browser delivery flow
provides:
  - completed-round tab retirement and automatic close attempt
  - state-filtered browser recovery records
  - regression coverage for stale SSE rounds and terminal recovery filtering
affects: [browser, bridge, delivery, recovery, documentation]
tech-stack:
  added: []
  patterns: [round acceptance gate, explicit recoverable-state allowlist, v2 closure settings]
key-files:
  created: []
  modified: [server/bridge.js, web/live.js, web/app.js, web/settings-schema.js, lib/runtime-settings.cjs]
key-decisions:
  - "Retire the owning live-round gate immediately after acknowledged delivery so a browser-denied window.close cannot render a later round."
  - "Expose only drafting, detached, reconnecting, delivery-pending, and delivery-uncertain records to browser recovery."
  - "Default closure to after-delivery while preserving an explicit never setting as an opt-out."
metrics:
  duration: current-session
  completed: 2026-07-19
status: complete
---

# Phase 19 Plan 01: Browser lifecycle and recovery corrections summary

Fixed both reported browser regressions: completed tabs are retired after successful delivery, and normal terminal rounds no longer appear as unrelated local-server recovery candidates.

## Accomplishments

- Added a live-round acceptance gate that ignores later SSE snapshots after the current round is delivered.
- Wired delivery acknowledgement to the v2 closure setting and the existing close attempt, with an explicit `never` setting still respected.
- Filtered `/rounds` recovery records to states that can actually be resumed, retaining delivery-uncertain records for safe result recovery.
- Added focused regressions covering live retirement, bridge filtering, server delivery behavior, and settings/ack wiring.
- Updated API, overview, testing, and release-handoff documentation to reflect the corrected lifecycle and archived phase paths.

## Verification

- `npm test`: 507 passed, 0 failed, 1 expected Playwright dependency skip.
- `npm run test:browser`: pass.
- `npm run lint`: pass.
- `npm run format:check`: pass.
- `npm audit --audit-level=high`: 0 vulnerabilities.
- In-app browser smoke: active question rendered normally and no recovery/resume prompt appeared for the live round.
