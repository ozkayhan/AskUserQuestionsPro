# Phase 15 UI Review

**Date:** 2026-07-18 (Europe/Istanbul)
**Scope:** settings, waiting, recovery, reconciliation, delivery, responsive layout, keyboard/focus
**Requirements:** UI-01, UI-02

## Review matrix

| Area | Review result | Disposition |
|---|---|---|
| Waiting shell | PASS after `a09ea04` | No-sidebar idle state now uses `.app--waiting { grid-template-columns: 1fr; }`; active rounds keep the existing sidebar grid. |
| Settings desktop | PASS | Centered modal and readable control groups; long content scrolls inside the dialog. |
| Settings mobile | PASS | 390x844 controls wrap and the dialog remains operable with internal scroll. |
| Settings cancel semantics | PASS | Unsaved theme preview is transient; Cancel restores the session baseline and does not persist. |
| Recovery chooser | PASS with evidence limit | Exact round selection and explicit Continue without recovery worked. The attempted mobile chooser capture was invalid/duplicate and was removed; source/DOM evidence is used instead of visual proof. |
| Draft reconciliation | PASS | Server/local revision conflict is explicit; Keep server is an explicit choice and preserves authority. |
| Delivery/retry | PASS by contracts; browser lane UNAVAILABLE | Acknowledgement is replayable and close/fallback ownership is fail-safe in automated contracts; independent browser close-denied and retry evidence remains unavailable. |
| Keyboard/focus/dialogs | PASS by source contracts; independent browser lane UNAVAILABLE | Tab containment, Escape return focus, scale ArrowUp+Enter, labelled dialogs, and live status are covered by source/DOM contracts; the optional Playwright package is unavailable for an independent rerun. |
| Responsive overflow | PASS for observed settings/question states | 390x844 smoke showed no horizontal clipping; long content uses scroll. |
| AT/native/authenticated hosts | UNAVAILABLE | External handoff only; no unsupported release claim. |

## Priority findings

1. **Resolved:** idle waiting screen had a phantom sidebar track that wrapped the heading one word per line. The explicit waiting state and regression test now prevent recurrence.
2. **No new product blocker:** current settings, recovery, reconciliation, and delivery contracts behaved as expected in the available local browser path.
3. **Release evidence gap:** retain independent browser delivery/close/retry/focus traces plus a real screen-reader/native-host/ownership-denied run before promoting those lanes to supported evidence.

## Quality gate results

- Focused UI/recovery suite: 22 passed, 1 expected Playwright-package skip.
- Full suite: 505 passed, 1 expected Playwright-package skip.
- `npm run lint`: passed.
- `npm run format:check`: passed.

## Scope boundary

This review does not claim authenticated Claude/Codex behavior, Windows/Linux native behavior, screen-reader output, private-profile quota behavior, or a real denied-close browser run.
