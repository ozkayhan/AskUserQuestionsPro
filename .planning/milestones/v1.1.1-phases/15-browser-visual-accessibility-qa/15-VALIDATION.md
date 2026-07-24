---
phase: 15-browser-visual-accessibility-qa
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-18
---

# Phase 15 — Nyquist Validation Strategy

## Test Infrastructure

| Property | Value |
|---|---|
| Framework | Native `node:test`, repository ESLint/Prettier, and the available Browser skill |
| Browser target | Shipped bridge at `http://127.0.0.1:4517/` after `npm run serve` |
| Focused command | `node --test test/views-a11y.test.js test/views-a11y-recovery.test.js test/browser-recovery-e2e.test.js test/live.test.js test/browser-settings-e2e.test.js` |
| Full quality commands | `npm test`, `npm run lint`, `npm run format:check` |
| Settings CLI smoke | `npm run test:browser` — settings CLI E2E only, not the full browser matrix |
| Evidence files | `15-UI-EVIDENCE.md`, `15-UI-REVIEW.md`, `15-BROWSER-EVIDENCE.md` |

## Requirement Mapping

| Requirement | Observable behavior | Automated proof | Browser/manual proof | Evidence |
|---|---|---|---|---|
| UI-01 | Settings, waiting, recovery, and delivery surfaces are visually/accessibly reviewable at desktop and 390x844, or each unavailable lane is explicit. | Focused command; `npm test`; `npm run lint`; `npm run format:check` | Browser skill at the target URL checks settings, waiting, recovery, delivery, responsive scroll, keyboard/focus, dialogs, and live announcements. | `15-UI-EVIDENCE.md` rows with PASS or UNAVAILABLE and actual screenshot paths only. |
| UI-02 | Exact recovery, Keep server reconciliation, acknowledgement-before-close, keyboard/focus ownership, and actionable fallbacks are verified without overclaiming unavailable environments. | Focused command plus `npm run test:browser` as settings-only supplement. | Browser skill records exact recovery, reconciliation, ack/close order, uncertain retry, denied-close fallback, Tab/Escape/focus return, and scale keyboard flow. | `15-UI-EVIDENCE.md` and reconciled `15-BROWSER-EVIDENCE.md`. |

## Per-Task Validation Map

| Task | Requirement | Automated check | Concrete evidence check |
|---|---|---|---|
| 15-01-01 | UI-01, UI-02 | `node --test test/browser-recovery-e2e.test.js test/views-a11y.test.js test/views-a11y-recovery.test.js` | Waiting shell is one column; active shell retains sidebar; source contracts remain green. |
| 15-01-02 | UI-01, UI-02 | `node --test test/views-a11y.test.js test/views-a11y-recovery.test.js test/browser-recovery-e2e.test.js test/live.test.js test/browser-settings-e2e.test.js` | Focused reliability/accessibility contracts pass; Playwright skip is recorded if present. |
| 15-02-01 | UI-01, UI-02 | Serve health check plus `npm run test:browser` | Browser skill attempts `http://127.0.0.1:4517/`; each settings/recovery/reconciliation/delivery/ack/fallback/responsive/keyboard lane is PASS or dated UNAVAILABLE in `15-UI-EVIDENCE.md`. |
| 15-02-02 | UI-01, UI-02 | Non-empty evidence files and required-term check | Review matrix separates automated, browser, screenshot-backed, and unavailable claims. |
| 15-02-03 | UI-01, UI-02 | Focused command; `npm test`; `npm run lint`; `npm run format:check` | Exact command outputs and counts are appended; no dirty user planning file is modified or staged. |

## Unavailable-Evidence Rule

No Browser session, screenshot retention, failure injection, screen-reader/AT, private-mode quota, origin drift, opener/profile failure, denied `window.close()`, authenticated host, or native OS result may be represented as passed when unavailable. The executor must add a dated `UNAVAILABLE` entry naming the missing capability, attempted command/path, and handoff needed; screenshot paths are valid only when the artifact exists under `test/artifacts/phase15-browser-qa/`.

## Sign-Off Criteria

- [ ] Every UI-01/UI-02 row has automated proof, browser observation, or explicit unavailable evidence.
- [ ] `npm test`, `npm run lint`, and `npm run format:check` are executable checks in the plan and recorded.
- [ ] The `npm run test:browser` limitation is stated and not used as full-matrix proof.
- [ ] Evidence is redacted and the two pre-existing dirty planning files remain untouched.
