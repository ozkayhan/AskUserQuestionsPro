# Phase 11 browser recovery evidence

Date: 2026-07-17 (Europe/Istanbul)

## Automated evidence

- `node --test test/live.test.js test/draft-writer.test.js test/app-state.test.js test/views-a11y-recovery.test.js test/browser-recovery-e2e.test.js test/bridge-client.test.js` — PASS.
- Existing `test/browser-settings-e2e.test.js` — skipped when the Playwright Node package is unavailable.
- `npm run test:browser` — environment-dependent CLI path; run separately when the local `playwright-cli` session is available.
- `npm run lint` — not runnable in this workspace because `eslint` is not on PATH; no package was installed.
- `npm run format:check` — not runnable because the Prettier executable is not on PATH.

## Local browser evidence

`playwright-cli` at `/Users/oka/.local/bin/playwright-cli` was used against an
isolated bridge on `127.0.0.1:4527` with a synthetic one-question round. The
run was intentionally separate from the user's active bridge and used no
external host installation.

Observed on 2026-07-17:

- The live question rendered with zero page errors.
- A local/server revision mismatch opened `Saved round changed`; the heading
  received focus, Tab stayed inside the dialog, and `Discard local draft`
  returned to the round without losing the server answer.
- Submitting the answer completed the durable delivery path; the browser
  returned to waiting and the recoverable-round chooser showed only redacted
  state/time/question-count metadata.
- Escape dismissed the recovery chooser and returned to the waiting surface.

This is a real local browser smoke run, not authenticated Claude/Codex host
evidence. The automated contract tests remain the evidence for external-host
and failure-injection paths.

## Scenario matrix and limitations

| Scenario | Evidence | Limitation |
|---|---|---|
| Exact round selection / no latest fallback | local chooser smoke + automated contract + `getRecoverableRounds` test | External-host selection remains out of scope |
| Revision conflict and storage failure preservation | local conflict smoke + draft-writer tests + typed recovery errors | Quota/private-mode injection not run |
| Pending → acknowledged delivery | local submit/ack smoke + server ack contract | External host delivery remains out of scope |
| Uncertain delivery / denied close | transition and `attemptClose` tests | Browser ownership denial not forced in this smoke |
| Origin/port drift and opening fallback | typed opening result and recovery error seams | External opener/profile failure not launch-tested |
| Keyboard focus, Escape, live announcements | local focus/Tab/Escape smoke + mounted-source contracts | Screen reader still needs manual AT |
| Narrow viewport / reduced motion | responsive CSS and existing settings evidence | No new narrow-viewport screenshot captured |

No question or answer payload is included in evidence, diagnostics, or recovery
metadata.
