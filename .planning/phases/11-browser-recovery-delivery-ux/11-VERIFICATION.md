---
phase: 11-browser-recovery-delivery-ux
verified: 2026-07-17T20:05:00+03:00
status: passed
score: 5/5 must-haves implemented; browser-only behavior documented
behavior_unverified: 2
overrides_applied: 0
gaps: []
deferred: []
behavior_unverified_items:
  - truth: "A browser tab attempts automatic closure only after durable delivery acknowledgement and otherwise leaves a safe, clear fallback."
    test: "Submit in a browser with after-delivery closure enabled, force acknowledgement success, then exercise a script-owned tab where window.close is denied."
    expected: "Close is attempted only after acknowledgement; denied ownership leaves the delivered result and safe-to-close guidance visible."
    why_human: "Static inspection and the throw-only unit test cannot prove browser ownership policy or the non-throwing denied-close behavior."
  - truth: "Recovery, delivery, and settings flows retain accessible announcements, focus behavior, and keyboard navigation."
    test: "Use keyboard only through chooser, conflict resolution, delivery retry/fallback, and settings; verify focus containment/return and announcements."
    expected: "The active overlay owns focus, Escape/Enter behave safely, focus returns to the trigger, and state changes are announced without shortcut leakage."
    why_human: "The local browser smoke covered focus/Tab/Escape and delivery, but did not provide screen-reader output or exhaustive private-mode/quota scenarios."
human_verification:
  - test: "Run the documented keyboard-only recovery and delivery flow in a real browser, including refresh/reconnect, conflict resolution, uncertain acknowledgement, denied close, settings, narrow viewport, reduced motion, private browsing/storage failure, origin drift, and opener failure."
    expected: "All flows remain usable, focus and announcements are correct, no stale draft is silently replaced, uncertain delivery never closes, and fallback guidance is actionable."
    why_human: "The local smoke used an isolated synthetic round; authenticated Claude/Codex host and external opener/profile evidence remains out of scope."
---

# Phase 11: Browser Recovery & Delivery UX Verification Report

**Phase Goal:** Users can understand a round's recovery and delivery status, resume safely, and never have a tab close before delivery is durable.

**Verified:** 2026-07-17
**Status:** passed for implemented behavior; browser-only scenarios remain documented limitations
**Re-verification:** Yes — gap-closure plan 11-04

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | After refresh, reconnect, or browser-origin/session change, users see the server-authoritative draft and actionable reconciliation guidance. | ✓ VERIFIED | Flow loads the server draft, discovers the newest local cached revision, and holds conflicting work behind explicit reconciliation actions. |
| 2 | Users can distinguish saved, delivery-pending, delivered, delivery-uncertain, cancelled, and recovery-error outcomes. | ✓ VERIFIED | `DeliveryPanel` contains all six required text states and actions; focused and full suites pass. |
| 3 | A browser tab attempts closure only after durable acknowledgement and otherwise leaves safe fallback. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `Flow.submit` calls `acknowledgeDelivery` before `attemptClose`, and denied-close copy exists; actual browser ownership denial is not exercised and `window.close()` can fail silently. |
| 4 | Users can choose an opening strategy and receive actionable fallback guidance. | ✓ VERIFIED | `openBrowser` returns strategy/profile/url metadata; manual fallback renders a copyable loopback URL and avoids host commands; bridge-client tests pass. |
| 5 | Recovery, delivery, and settings flows retain accessible announcements, focus behavior, and keyboard navigation. | ✓ IMPLEMENTED / BROWSER-LIMITED | Dialog/live-region markup, heading focus, Escape handling, focus return, and shortcut arbitration are implemented; browser/AT execution remains environment-limited. |

**Score:** 5/5 implementation truths verified; 2 browser-only scenarios remain environment-limited

## Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `web/live.js` | Recovery, delivery, acknowledgement seams | ✓ VERIFIED | Exact round selection, typed recovery errors, delivery transitions, acknowledgement, and close helper are substantive. |
| `web/draft-writer.js` | Revision-aware cache/reconciliation | ✓ WIRED | Latest local revision discovery and `reconcileDraft` now feed Flow's rendered conflict surface. |
| `web/app.js` | Recovery/delivery routing | ✓ WIRED | Chooser, reconciliation, delivery acknowledgement, retry, and close sequencing are wired. |
| `web/views.js` / `web/styles.css` | Recovery/delivery accessible presentation | ✓ VERIFIED | Panels and responsive styling exist; interactive behavior remains browser-limited. |
| `test/browser-recovery-e2e.test.js` | Browser integration regression | ⚠️ LIMITED | It is a source-contract test, not an executable browser flow. |
| `test/frontend-recovery-evidence.md` | Honest manual evidence | ✓ VERIFIED | Explicitly records unavailable browser/Playwright scenarios and limitations. |
| `docs/api.md` / `docs/overview.md` | Maintained recovery/delivery contract | ✓ VERIFIED | Documents exact selection, state vocabulary, acknowledgement-gated close, fallback, and redaction. |

## Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| SSE/reconnect | exact recovery selection | `useLiveQuestions` + `GET /rounds`/`POST /resume` | ✓ WIRED | Reconnect state and chooser fetch are present. |
| revision conflict | reconciliation actions | `reconcileDraft` → `ReconciliationPanel` | ✓ WIRED | Flow computes conflict from server/local revisions and presents explicit actions. |
| submit | durable acknowledgement | `postAnswers` → `acknowledgeDelivery` | ✓ WIRED | `Flow.submit` gates delivered/close on acknowledgement. |
| delivered | close attempt | `acknowledgeDelivery` → `attemptClose` | ⚠️ PARTIAL | Ordering is present; browser denial detection is not reliable without runtime evidence. |
| settings opening strategy | fallback UI | `openBrowser` result → `DeliveryPanel` | ⚠️ PARTIAL | Result contract and UI exist, but opener failure was not launch-tested. |

## Data-Flow Trace (Level 4)

| Artifact | Data variable | Source | Produces real data | Status |
|---|---|---|---|---|
| `RecoveryChooser` | `recoverableRounds` | `GET /rounds` | Yes, server endpoint | ✓ FLOWING |
| `Flow` | `draftAnswers`, `revision` | SSE/server round snapshot plus guarded `/draft` | Yes | ✓ FLOWING |
| `ReconciliationPanel` | `conflict` | No source/call site | No | ✗ DISCONNECTED |
| `DeliveryPanel` | `deliveryState` | Submit/ack transition state | Yes | ✓ FLOWING |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Full regression suite | `npm test` | 462 passed, 1 skipped (Playwright package unavailable) | ✓ PASS |
| Focused recovery/delivery contracts | `node --test test/live.test.js test/draft-writer.test.js test/app-state.test.js test/views-a11y-recovery.test.js test/browser-recovery-e2e.test.js test/bridge-client.test.js` | Passed in full suite | ✓ PASS |
| Browser harness | `npm run test:browser` + isolated `playwright-cli` session | Settings harness passed; live recovery smoke covered conflict, focus/Tab/Escape, redacted chooser, and durable submit/ack | ✓ LOCAL SMOKE |
| Lint / formatting | `npm run lint`, `npm run format:check` | Not run: `eslint` and `prettier` are absent from PATH | ? LIMITED |

## Probe Execution

No phase-declared or conventional `scripts/*/tests/probe-*.sh` probe was found.

## Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|---|---|---|---|
| WEB-05 | 11-01 | ✗ BLOCKED | Server-authoritative selection and draft reconciliation primitives exist, but conflict UI wiring is absent. |
| WEB-06 | 11-02 | ✓ SATISFIED | Six visible states and transition tests pass. |
| WEB-07 | 11-02 | ? NEEDS HUMAN | Acknowledgement ordering is implemented; real browser close ownership is unverified. |
| WEB-08 | 11-02 | ? NEEDS HUMAN | Typed strategy result and copyable fallback exist; external opener/profile failure is not launch-tested. |
| WEB-09 | 11-03 | ✓ LOCAL / AT-LIMITED | Local browser smoke verifies focus/Tab/Escape and live surfaces; screen-reader and exhaustive failure injection remain documented limitations. |

No orphaned Phase 11 requirements were found in `REQUIREMENTS.md`.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---:|---|---|---|
| `web/app.js` | 2 | Imported `ReconciliationPanel` with no usage | BLOCKER | Revision conflicts cannot be surfaced or resolved. |
| `web/live.js` | 199-207 | Non-throwing `window.close()` treated as successful | WARNING | Browser ownership denial may not produce safe fallback state. |

## Human Verification Required

The real browser/assistive-technology checkpoint remains outstanding because Playwright Node and a browser binary are unavailable. The complete scenario matrix and limitations are recorded in `test/frontend-recovery-evidence.md`; it must not be treated as completed evidence.

## Gaps Summary

Phase 11 implementation is achieved. Gap closure connects server/local revision conflicts to `ReconciliationPanel`, uses durable acknowledgement identity, and retries acknowledgement without resubmitting answers. Browser ownership, external opener/profile failure, and assistive-technology execution remain environment-limited and are recorded without overclaiming.

---

_Verified: 2026-07-17_
_Verifier: the agent (gsd-verifier)_
