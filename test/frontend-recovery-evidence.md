# Phase 11 browser recovery evidence

Date: 2026-07-17 (Europe/Istanbul)

## Automated evidence

- `node --test test/live.test.js test/draft-writer.test.js test/app-state.test.js test/views-a11y-recovery.test.js test/browser-recovery-e2e.test.js test/bridge-client.test.js` — PASS.
- Existing `test/browser-settings-e2e.test.js` — skipped when the Playwright Node package is unavailable.
- `npm run test:browser` — environment-dependent CLI path; run separately when the local `playwright-cli` session is available.
- `npm run lint` — not runnable in this workspace because `eslint` is not on PATH; no package was installed.
- `npm run format:check` — not runnable because the Prettier executable is not on PATH.

## Local browser evidence

`playwright-cli` is present at `/Users/oka/.local/bin/playwright-cli`, but the
Playwright Node package and a browser binary are not resolvable from this
workspace. The available CLI was therefore not claimed as a completed
recovery-flow run: no authenticated host round can be created safely through
the static settings-only harness. The automated contract tests above provide
the strongest reproducible local evidence for chooser semantics, redaction,
delivery transitions, close denial, focus-owned dialogs, and reduced-motion
CSS.

## Scenario matrix and limitations

| Scenario | Evidence | Limitation |
|---|---|---|
| Exact round selection / no latest fallback | automated contract + `getRecoverableRounds` test | Full interactive chooser needs a browser runtime |
| Revision conflict and storage failure preservation | draft-writer tests + typed recovery errors | Quota/private-mode injection not run in a real browser |
| Pending → acknowledged delivery | delivery transition tests + server ack contract | Full click-through unavailable without Playwright runtime |
| Uncertain delivery / denied close | transition and `attemptClose` tests | Browser ownership policy not exercised interactively |
| Origin/port drift and opening fallback | typed opening result and recovery error seams | External opener/profile failure not launch-tested |
| Keyboard focus, Escape, live announcements | mounted-source accessibility contract tests | Screen reader and real tab order require manual browser/AT |
| Narrow viewport / reduced motion | responsive CSS and existing settings evidence | No fresh screenshot artifact due missing browser runtime |

No question or answer payload is included in evidence, diagnostics, or recovery
metadata.
