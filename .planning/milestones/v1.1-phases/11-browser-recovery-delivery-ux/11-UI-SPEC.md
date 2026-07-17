---
phase: 11
slug: browser-recovery-delivery-ux
status: ready
shadcn_initialized: false
preset: none
created: 2026-07-17
---

# Phase 11 — Browser Recovery & Delivery UX Design Contract

The existing vendored React + CSS UI remains the source of truth. This contract defines the visible recovery and delivery surfaces required by D-01 through D-05; no third-party UI or runtime dependency is introduced.

## Information architecture

- **Round status strip:** persistent, text-backed lifecycle/delivery state with opaque round context and last-saved/revision freshness.
- **Recovery chooser:** exact redacted round list from `GET /rounds`; selection is explicit and includes updated time, state, expiry, and question count only.
- **Reconciliation panel:** shown when local draft revision and server revision diverge; offers keep-server, review differences, and discard-local-draft actions while retaining both until choice.
- **Delivery result panel:** distinguishes pending, delivered, uncertain, cancelled, and recovery-error outcomes; exposes only actions authorized by server capabilities.
- **Opening guidance:** states the selected browser strategy/profile result and provides a copyable loopback URL/manual guidance on failure.

## State copy contract

| State | Required visible meaning | Safe action |
|---|---|---|
| Saved | `Saved locally on the bridge.` | Continue editing or submit |
| Delivery pending | `Saving your answer for delivery…` | Wait; prevent duplicate submit |
| Delivered | `Delivered to the host.` | Close when allowed; reopen result |
| Delivery uncertain | `Delivery status is uncertain. Your answer is preserved.` | Check status, retry acknowledgement, or recover exact round |
| Cancelled | `This round was cancelled.` | Start a new round or view retained record |
| Recovery error | `This round could not be recovered safely. Your current work was not replaced.` | Retry, choose another round, or copy support-safe diagnostics |

Status text must be paired with `role="status"`/polite live announcements; failures use `role="alert"`. Do not rely on color, icon, or weight alone.

## Interaction and accessibility contract

- Recovery chooser and reconciliation surfaces are real dialogs with labelled heading/description, `aria-modal`, focus containment, Escape cancellation where safe, and focus return to the triggering control.
- Delivery-pending disables duplicate submit and announces progress; delivery-uncertain never auto-closes the tab.
- Automatic close runs only after acknowledged delivery and uses a safe fallback message when `window.close()` is denied.
- All controls are keyboard reachable with 44px effective targets; global question shortcuts do not act while a dialog, chooser, reconciliation panel, file input, or delivery error action owns focus.
- Long metadata wraps without horizontal scrolling; narrow viewports scroll vertically; reduced-motion mode remains fully intelligible.

## Error and privacy contract

Recovery, storage/quota, origin drift, and browser-opening failures explain the next action and whether the prior effective draft remains active. Diagnostics contain opaque identifiers and lifecycle metadata only; question and answer content is never included in recovery lists, errors, logs, or support copy.

## Verification contract

Automated coverage must exercise refresh/reconnect reconciliation, explicit round selection, state transitions, acknowledgement-gated closure, denied `window.close()`, opening-strategy fallback, status announcements, focus ownership, and keyboard arbitration. Manual browser evidence must cover private browsing, storage/quota failure, localhost port/origin drift, narrow viewport, reduced motion, and a keyboard-only recovery/delivery flow.
