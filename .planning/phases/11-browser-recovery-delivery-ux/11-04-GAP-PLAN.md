---
phase: 11-browser-recovery-delivery-ux
plan: 04
type: gap_closure
wave: 4
depends_on: [11-03]
files_modified: [web/live.js, web/draft-writer.js, web/app.js, web/views.js, test/live.test.js, test/draft-writer.test.js]
autonomous: true
requirements: [WEB-05, WEB-06, WEB-07, WEB-09]
---

# Phase 11 Gap Closure — Recovery and Delivery Review Findings

## Objective

Close the two blocker findings and the directly related recovery accessibility gap from `11-REVIEW.md`:

1. Use the durable `roundId` for result acknowledgement while retaining the numeric transport id for `/answer` and `/draft`.
2. Retry the idempotent acknowledgement instead of resubmitting an already consumed answer.
3. Wire revision-aware local draft discovery to the explicit reconciliation dialog and add runtime focus/Escape ownership.

## Verification

- `node --test test/live.test.js test/draft-writer.test.js test/app-state.test.js test/views-a11y-recovery.test.js`
- `npm test`
- `npm run test:browser` when the workspace browser runner is available
- Re-review changed recovery/delivery files and update `11-REVIEW.md`/`11-VERIFICATION.md` with the fixed status and remaining environment limitations.
