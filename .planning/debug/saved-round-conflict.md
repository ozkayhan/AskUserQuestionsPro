---
status: resolved
trigger: "After confirming an answer and moving from one question to the next, the Saved round changed revision-conflict dialog appears repeatedly."
created: 2026-07-24T00:00:00+03:00
updated: 2026-07-24T19:20:00+03:00
goal: find_and_fix
---

# Debug Session: Repeated Saved Round Revision Conflict

## Symptoms

- Expected: Confirming an answer and advancing to the next question should not show a recovery dialog.
- Actual: The Saved round changed dialog appears after advancing, repeatedly.
- Error messages: Server revision 1; local revision 0.
- Timeline: Reproduces on every question after confirming an answer.
- Reproduction: Answer one question, double-click/confirm the answer, advance to the next question.

## Current Focus

- hypothesis: The browser's best-effort draft mirror is retained at an old expected revision during the normal autosave acknowledgement, so the reconciliation effect mistakes a normal in-flight/queued edit for an external revision conflict.
- test: Trace the draft writer's storage keys and revision updates through two consecutive material edits, then add a focused failing regression test for the observed lifecycle.
- expecting: A stale local-storage entry or incorrect acknowledgement/re-key ordering that explains local revision 0 versus server revision 1.
- next_action: Reproduce the writer sequence in a test, identify the exact stale-key transition, then patch only the root cause.

## Evidence

- timestamp: 2026-07-24T00:00:00+03:00
  observation: Flow reconciles any newest local pending revision different from the SSE server revision without distinguishing an unacknowledged request from an external edit.
- timestamp: 2026-07-24T00:00:00+03:00
  observation: DraftWriter acknowledges by expected revision, while newer queued edits can temporarily retain an older revision key until the request chain drains.
- timestamp: 2026-07-24T19:15:00+03:00
  observation: Localhost browser smoke reproduced two successful POST /draft requests and no Saved round changed dialog after confirming the first answer and advancing.

## Eliminated

- hypothesis: A real external revision conflict was the cause.
  reason: The server broadcasts the new revision before the matching fetch response clears the local mirror; the mismatch disappears when the autosave settles.

## Resolution

- root_cause: The /draft SSE broadcast can reach Flow before the matching fetch acknowledgement. Flow treated the still-pending local revision 0 mirror as an external conflict against server revision 1.
- fix: DraftWriter now exposes its in-flight/queued state and notifies Flow when the save chain settles. Flow suppresses reconciliation during that normal race and re-runs it after settlement, preserving real conflict detection.
- verification: Focused tests, lint, and format check pass. Playwright CLI smoke confirmed two POST /draft 200 responses and no Saved round changed dialog after double-confirming the first answer and entering question two. Full npm test has one pre-existing documentation-link failure unrelated to this change.
- files_changed: web/draft-writer.js, web/app.js, test/draft-writer.test.js, test/app-state.test.js
