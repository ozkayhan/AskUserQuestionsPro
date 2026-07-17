---
phase: 11-browser-recovery-delivery-ux
source: 11-REVIEW.md
status: fixed
fixed: 2026-07-17
---

# Phase 11 Review Fixes

The review blockers were addressed in gap-closure plan 11-04.

| Finding | Resolution | Evidence |
|---|---|---|
| CR-01 durable acknowledgement used numeric id | SSE durable `roundId` is carried separately and passed to `/rounds/<roundId>/ack`; numeric `id` remains for `/answer` and `/draft`. | `test/live.test.js` exact URL regression |
| CR-02 retry resubmitted the answer | Delivery retry now invokes idempotent `acknowledgeDelivery` and never calls `/answer` again. | delivery state path in `web/app.js`; full test suite |
| WR-01 reconciliation was unreachable | Flow discovers the newest local revision, computes an explicit conflict, and renders keep-server/review/discard actions. | `web/draft-writer.js`, `web/app.js`, draft revision regression |
| WR-02 dialogs lacked runtime focus ownership | Recovery and reconciliation dialogs focus their heading, support Escape where safe, and restore prior focus. | `web/views.js`; accessibility source contracts |

The browser-opening warning remains environment-limited: opening occurs in the host process before a browser page exists, so manual fallback is exposed as a loopback URL by the opener result and documented honestly.
