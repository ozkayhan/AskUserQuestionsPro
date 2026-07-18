---
status: partial
phase: 11-browser-recovery-delivery-ux
source: 11-01-SUMMARY.md, 11-02-SUMMARY.md, 11-03-SUMMARY.md, 11-04-SUMMARY.md, 11-VERIFICATION.md, 11-UI-SPEC.md, test/frontend-recovery-evidence.md
started: 2026-07-18T09:54:16Z
updated: 2026-07-18T09:54:16Z
---

## Current Test

[automated/local verification complete; human browser and assistive-technology checkpoint remains outstanding]

## Tests

### 1. Exact round selection and fixed POST /resume contract
expected: Recovery requires an explicit opaque `roundId` or `requestId`; the browser sends `POST /resume` with the exact selector in the JSON body and never chooses the newest round implicitly.
result: pass
source: automated
evidence: `node --test test/live.test.js ...` passed `recovery requires exact selection and never chooses latest implicitly`, `selectRecoveryRound sends exact round selector to the supported resume route`, and server `resume requires an explicit roundId or requestId` coverage.

### 2. Server-authoritative draft reconciliation
expected: A newer server revision and a local cached revision remain distinct until an explicit keep-server, review-differences, or discard-local-draft action; selecting the server clears obsolete local revisions without silently overwriting work.
result: pass
source: automated
evidence: Focused suite passed draft reconciliation, newest-local-revision discovery, obsolete-revision cleanup, and app wiring tests.

### 3. Loss-aware delivery states
expected: Saved, delivery-pending, delivered, delivery-uncertain, cancelled, and recovery-error are distinct text-backed states with safe next actions; duplicate submit is prevented and uncertain results remain recoverable.
result: pass
source: automated
evidence: Focused suite passed delivery transition, app-state, and `DeliveryPanel` state-copy/live-region coverage.

### 4. Durable acknowledgement before automatic close
expected: The app reaches delivered and attempts automatic close only after durable acknowledgement using the opaque durable `roundId`; acknowledgement is idempotent and the result remains available when close is denied.
result: pass
source: automated
evidence: Focused suite passed `acknowledgeDelivery uses the durable round id and is replayable` and `uncertain delivery and denied close remain recoverable`; source ordering is `acknowledgeDelivery` then `attemptClose`.

### 5. Retry and opening/recovery fallback
expected: An uncertain acknowledgement retries acknowledgement only, never resubmits consumed answers; network/storage/origin/opening failures preserve current work and provide retry, exact-round recovery, or copyable loopback guidance without host commands.
result: pass
source: automated
evidence: Focused live/app/bridge-client/views tests passed retry, typed recovery error, opening strategy, fallback URL, redaction, and no-resubmit contracts.

### 6. Focus, keyboard ownership, and live regions
expected: Recovery/reconciliation dialogs have modal semantics, labelled headings, focus containment, Escape handling, focus restoration, status/alert announcements, and no global question-shortcut leakage while an overlay owns focus.
result: pass
source: automated
evidence: Focused `app-state`, `views`, and `views-a11y-recovery` tests passed; source contracts cover `aria-modal`, polite live text, focus trap, Escape, and shortcut arbitration.

### 7. Full regression safety net
expected: The complete current Node test suite remains green with no Phase 11 regression.
result: pass
source: automated
evidence: `npm test` exited 0: 500 passed, 0 failed, 1 skipped. The single skip is the existing Playwright Node-package-dependent browser test.

### 8. Available browser CLI smoke
expected: The repository browser CLI smoke starts an isolated local bridge and verifies browser settings dialog focus, Tab containment, Escape return-focus, persisted settings, reduced motion, import preview, and narrow viewport behavior.
result: pass
source: browser-cli
evidence: `npm run test:browser` exited 0 with `ASSERTIONS: PASS`; generated browser artifacts were removed after verification.

### 9. Real-browser recovery/delivery and assistive-technology matrix
expected: In a real browser, keyboard-only recovery, conflict resolution, uncertain acknowledgement, denied `window.close()`, private browsing/quota failure, origin/port drift, opener/profile failure, narrow viewport, reduced motion, and screen-reader announcements all work end to end.
result: skipped
reason: Requires a human browser/assistive-technology pass and failure injection not provided by the current executable CLI smoke. Archived evidence records a prior isolated local recovery smoke for conflict, Tab/Escape, redacted chooser metadata, and durable submit/ack, but does not prove browser ownership denial, screen-reader output, private-mode quota behavior, origin drift, or external opener/profile failure.

## Summary

total: 9
passed: 8
issues: 0
pending: 0
skipped: 1
blocked: 0

## Command Results

| Command | Result |
|---|---|
| `node --test test/live.test.js test/draft-writer.test.js test/app-state.test.js test/views.test.js test/views-a11y-recovery.test.js test/browser-recovery-e2e.test.js test/bridge-client.test.js` | PASS — 49 passed, 0 failed |
| `npm test` | PASS — 500 passed, 0 failed, 1 expected Playwright-package skip |
| `npm run test:browser` | PASS — isolated Playwright CLI settings smoke, `ASSERTIONS: PASS` |
| `npm run lint` | NOT RUNNABLE — `eslint: command not found` (exit 127) |
| `npm run format:check` | NOT RUNNABLE — `prettier: command not found` (exit 127) |

An additional temporary recovery-chooser CLI probe was inconclusive because its synthetic host setup left the detached round on the active SSE question surface; it is not counted as an application failure. Temporary server/config/browser artifacts were cleaned. Existing unrelated worktree changes remain untouched.

## Human and Browser Limitations

- No authenticated Claude Code or Codex host was used.
- Browser ownership denial for `window.close()` was not forced; static/unit coverage proves ordering and denied-throw handling, not silent browser policy denial.
- Screen-reader announcements, private browsing/storage quota failure, localhost origin/port drift, preferred browser/profile launch failure, and a new narrow-viewport/reduced-motion recovery screenshot require manual execution.
- `test/browser-recovery-e2e.test.js` is a source-contract regression, not a full executable browser flow.
- `eslint` and `prettier` were not installed and were not installed during verification.

## Gaps

[none identified in automated/local verification; the skipped human/browser checkpoint is an environment limitation, not a diagnosed application defect]
