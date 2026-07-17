---
phase: 11-browser-recovery-delivery-ux
reviewed: 2026-07-17T00:00:00Z
depth: deep
files_reviewed: 14
files_reviewed_list:
  - docs/api.md
  - docs/overview.md
  - lib/bridge-client.mjs
  - test/app-state.test.js
  - test/bridge-client.test.js
  - test/browser-recovery-e2e.test.js
  - test/draft-writer.test.js
  - test/frontend-recovery-evidence.md
  - test/live.test.js
  - test/views-a11y-recovery.test.js
  - web/app.js
  - web/draft-writer.js
  - web/live.js
  - web/styles.css
findings:
  critical: 2
  warning: 3
  info: 0
  total: 5
status: fixed
---

# Phase 11: Code Review Report (initial; fixed in 11-REVIEW-FIX.md)

**Reviewed:** 2026-07-17
**Depth:** deep
**Files Reviewed:** 14
**Status:** issues_found

## Summary

The recovery metadata is appropriately redacted and the local bridge remains loopback-oriented, but the implemented browser delivery handshake cannot reach its successful state in the normal flow. The retry control also repeats an already-consumed answer submission instead of retrying acknowledgement. Accessibility evidence is largely source-contract based; the recovery dialogs lack focus management, and the advertised revision reconciliation UI is not wired into the application.

## Critical Issues

### CR-01: Acknowledgement uses the wrong round identifier

**Severity:** BLOCKER

**File:** `web/app.js:23-56, 376-381`

**Issue:** `useLiveQuestions()` receives both `id` (the numeric pending-round ID) and `roundId` (the durable `round_*` ID), but `App` destructures only `id` and passes that numeric value to `Flow` as `roundId`. `Flow` then calls `acknowledgeDelivery(roundId, capability)`, which requests `/rounds/42/ack`. The server route only accepts `/rounds/round_<...>/ack`, so every acknowledgement receives 404 and the UI enters `delivery-uncertain`; successful delivery is never recorded or eligible for close.

**Fix:** Preserve the SSE `roundId` separately and pass it to the acknowledgement call while continuing to use numeric `id` for `/answer` and `/draft`:

```js
const { id, roundId: durableRoundId, questions, capability, revision, draftAnswers } = useLiveQuestions();
// ...
<Flow roundId={id} durableRoundId={durableRoundId} ... />
// acknowledgeDelivery(durableRoundId, capability)
```

Add an integration test that asserts the exact `/rounds/round_*/ack` URL.

### CR-02: “Retry acknowledgement” resubmits the final answer

**Severity:** BLOCKER

**File:** `web/app.js:388-391, 568-572`

**Issue:** When `/answer` succeeds but `acknowledgeDelivery()` fails, the state becomes `delivery-uncertain` and `submitted` is reset. `DeliveryPanel` renders a button labelled “Retry acknowledgement”, but its `onRetry` is `() => submit()`. That calls `/answer` again against a round that `provideAnswers()` has already removed from `_pending`; the server returns `409 ownership_conflict`, changing the UI to `recovery-error` instead of retrying the idempotent `/ack` operation. This loses the intended recovery path and can leave a delivered answer visibly unresolved.

**Fix:** Keep a dedicated `retryAcknowledgement` callback that calls `acknowledgeDelivery(durableRoundId, capability)`, treats a successful replay as delivered, and leaves the immutable result intact on failure. Do not call `/answer` again after it has returned success.

## Warnings

### WR-01: Revision reconciliation is implemented but unreachable

**Severity:** WARNING

**File:** `web/draft-writer.js:125-136; web/views.js:31-46; web/app.js:75-136`

**Issue:** `reconcileDraft()` and `ReconciliationPanel` exist, but `Flow` only merges `draftAnswers` and the local draft directly. No caller invokes `reconcileDraft`, computes a conflict, or renders `ReconciliationPanel`. A differing local/server revision can therefore be silently merged by object spread, contrary to the stated invariant that both drafts remain until an explicit user choice.

**Fix:** Reconcile server and local drafts before initializing answer state; hold the flow behind `ReconciliationPanel` until the user selects keep-server, review, or discard-local, and test each choice.

### WR-02: Modal recovery dialogs do not manage keyboard focus

**Severity:** WARNING

**File:** `web/views.js:10-27, 31-46`

**Issue:** `RecoveryChooser` and `ReconciliationPanel` advertise `role="dialog" aria-modal="true"`, but neither moves focus into the dialog, traps focus, handles Escape, or restores focus to the invoking control. Keyboard and screen-reader users can remain on an obscured background while the UI claims the background is modal. The existing tests only match source strings and do not verify behavior.

**Fix:** Implement a shared modal focus hook: focus the heading or first actionable control on open, constrain Tab traversal, support Escape where appropriate, and restore the previously focused element on close. Add browser-level keyboard assertions.

### WR-03: Opening fallback is not connected to the delivery UI

**Severity:** WARNING

**File:** `web/views.js:49-68; web/app.js:568-572; lib/bridge-client.mjs:101-116`

**Issue:** `DeliveryPanel` supports an `opening` prop and renders a copyable loopback URL only when `opening.failed` is true, but `Flow` never passes `opening` or any result from `openBrowser()`. `openBrowser()` also returns `attempted: true` immediately even when the detached child later emits an `error`, so the browser cannot render the promised manual fallback for missing `open`/`xdg-open`/`cmd` executables.

**Fix:** Make the opener return an observable success/failure result (or accept an error callback/promise), store it in app state, and pass it to `DeliveryPanel`. Keep the fallback limited to the loopback URL and non-executable guidance as documented.

---

_Reviewed: 2026-07-17_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
