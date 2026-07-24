# Phase 15 Browser Evidence

**Date:** 2026-07-18 (Europe/Istanbul)
**Target:** `http://127.0.0.1:4517/` (an isolated browser smoke also used a free loopback port)
**Browser:** Chrome through the available Browser skill
**Data policy:** Synthetic round metadata only; no question or answer payloads are written here.

## Commands and results

| Command | Result |
|---|---|
| `node --test test/browser-recovery-e2e.test.js test/views-a11y.test.js test/views-a11y-recovery.test.js test/live.test.js test/browser-settings-e2e.test.js` | PASS: 22, SKIP: 1 expected Playwright-package skip |
| `npm test` | PASS: 505, SKIP: 1 expected Playwright-package skip |
| `npm run lint` | PASS |
| `npm run format:check` | PASS |
| `npm run test:browser` | PASS in the settings CLI smoke; it is supplementary settings evidence, not full browser matrix proof |
| `npm run serve` + loopback health/open check | PASS |

## Artifact inventory

- `test/artifacts/phase15-browser-qa/settings-desktop.png`
- `test/artifacts/phase15-browser-qa/settings-mobile-390x844.png`
- `test/artifacts/phase15-browser-qa/waiting-desktop.png` (recovery overlay present)

## Contract and browser mapping

- UI-01: settings/waiting responsive observations, corrected waiting shell, no-horizontal-clipping observation, and retained screenshots where meaningful.
- UI-02: exact recovery selection, explicit dismissal, server-authoritative draft reconciliation, keyboard/focus/dialog/live-region checks, acknowledgement/retry contracts, and explicit fallback gaps.
- Existing source contracts remain the executable authority for exact round selectors, redaction, delivery acknowledgement, uncertain delivery, and denied-close fallback.

Independent browser proof is **UNAVAILABLE** for runtime delivery acknowledgement/close, uncertain-retry failure injection, denied-close ownership, and focus-trace replay because the optional Playwright Node package is skipped and the temporary smoke transcript is not a retained executable artifact. The source/integration contracts remain PASS evidence for those behaviors.

## External handoff gaps

The following remain **UNAVAILABLE**, not passed: VoiceOver/other screen readers, private-mode quota pressure, origin/port drift, opener/profile launch failure, an actual user-owned denied `window.close()`, authenticated Claude/Codex sessions, and native Windows/Linux/macOS lanes.

## Worktree safety

The pre-existing `.planning/config.json` and `.planning/ui-reviews/.gitignore` were not modified or staged. Temporary browser logs and unrelated generated settings artifacts were removed; only the retained Phase 15 screenshots are intended for this evidence set.
