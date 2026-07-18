# Phase 15 UI Evidence

**Captured:** 2026-07-18 (Europe/Istanbul)
**Environment:** macOS workspace, local bridge, Browser skill/Chrome, loopback URL
**Requirements:** UI-01, UI-02

## Retained browser artifacts

These files contain only UI labels, settings metadata, and recovery metadata; no question or answer payloads are retained.

- `test/artifacts/phase15-browser-qa/settings-desktop.png` — 1512x737 settings panel.
- `test/artifacts/phase15-browser-qa/settings-mobile-390x844.png` — 390x844 settings panel.
- `test/artifacts/phase15-browser-qa/waiting-desktop.png` — 1512x737 waiting/recovery state; it is not a clean waiting-only capture because the recovery chooser was visible.

## Available browser matrix

| Scenario | Result | Evidence | Notes |
|---|---|---|---|
| Desktop settings layout and readable controls | PASS | `settings-desktop.png` | Modal is centered, controls remain readable, internal scroll is present for the long panel. |
| Mobile settings at 390x844 | PASS | `settings-mobile-390x844.png` | Segmented controls wrap without horizontal overflow; modal uses internal scroll. |
| Theme change then Cancel | PASS | Browser DOM observation | Selecting Dusk changed the preview; Cancel restored the AMOLED baseline (`data-theme=amoled`). No persisted write was made. |
| Settings keyboard/focus ownership | UNAVAILABLE for independently retained browser proof | Source contracts pass; temporary smoke transcript was inspected but not retained | Tab containment and Escape return-focus were observed during smoke, but the optional Playwright Node package is unavailable and no independently rerunnable browser artifact remains. |
| High contrast/reduce motion save and reload | PASS | Browser CLI command log from current smoke | Save/reload assertions passed; reduced-motion state was checked after reload. |
| Waiting desktop shell width | PASS | `test/browser-recovery-e2e.test.js` | Source-contract regression verifies `.app--waiting` uses one grid column. The retained waiting screenshot includes a recovery overlay, so it is not used as clean visual proof. |
| Active-round desktop two-column shell | PASS | `test/browser-recovery-e2e.test.js` | Regression verifies the sidebar shell remains two-column. |
| Mobile question layout and scroll | PASS | Browser DOM observation at 390x844 | Stage had bounded internal scroll; options and sticky hints remained reachable. No horizontal overflow was observed. |
| Exact recovery selection | PASS | Browser DOM observation + `test/browser-recovery-e2e.test.js` | Recovery chooser exposed the exact saved round and did not auto-select it; no screenshot is retained for this lane. |
| Continue without recovery | PASS | Browser DOM observation | Dismissal returned to the waiting surface; no screenshot is retained for this lane. |
| Draft reconciliation / Keep server | PASS | Browser DOM observation + `test/draft-writer.test.js` | Revision conflict dialog appeared after a browser edit; Keep server closed it without overwriting the selected server revision. |
| Scale keyboard flow | PASS | Browser DOM observation | ArrowUp changed the slider and Enter advanced to the next question. |
| Delivery acknowledgement before close | UNAVAILABLE for independent browser proof; PASS by source/integration contracts | `test/live.test.js` and recovery/delivery source contracts | Ordering is asserted by automated contracts; a retained runtime browser screenshot/trace of the close-denied branch was unavailable. |
| Uncertain acknowledgement/retry | UNAVAILABLE for independent browser proof; PASS by `test/live.test.js` | `test/live.test.js` | Transport contract and replayable acknowledgement assertions passed; no browser failure-injection artifact was retained. |
| Dialog labels/live regions | PASS | `test/views-a11y.test.js`, `test/views-a11y-recovery.test.js` | Recovery and delivery dialogs are labelled and live status text is present. |

## Honest unavailable lanes

| Lane | Status | Handoff |
|---|---|---|
| Screen-reader announcements and full AT matrix | UNAVAILABLE | Run VoiceOver/NVDA/JAWS or equivalent against the same scenarios and retain dated output. Source ARIA contracts are automated, but they are not a screen-reader run. |
| Private-mode storage quota | UNAVAILABLE | Repeat settings/draft flows in a private profile with quota pressure. |
| Browser origin/port drift | UNAVAILABLE | Start the bridge on a changed port/origin and exercise the opener/reconnect failure path. |
| Opener/profile launch failure | UNAVAILABLE | Block or remove the opener context and verify the visible manual URL fallback. |
| Actual ownership-denied `window.close()` | UNAVAILABLE | Reproduce in a user-owned tab and confirm the actionable fallback; source contract remains covered. |
| Authenticated Claude/Codex host delivery | UNAVAILABLE | Requires real authenticated host sessions; fake-host and adapter tests are not equivalent. |
| Native Windows/Linux/macOS matrix | UNAVAILABLE | Windows/Linux and native installer lanes require their native environments. |

No unavailable lane is counted as browser or native pass evidence.
