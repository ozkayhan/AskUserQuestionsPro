# Phase 11: Browser Recovery & Delivery UX — Context

**Gathered:** 2026-07-17
**Status:** Ready for planning
**Mode:** Autonomous conservative product-manager decisions (user unavailable)

## Domain

This phase turns the Phase 9 durable recovery API and Phase 10 effective settings contract into a browser flow that makes recovery and delivery state understandable and safe. The browser remains a local, single-user client of the loopback bridge; it must not invent a latest round, treat browser storage as authoritative, or close before durable acknowledgement.

## Decisions

### D-01 — Server authority and explicit recovery selection

After refresh, reconnect, or origin/session change, the browser rehydrates from the exact server-selected durable round and reconciles local edits against its revision. If the browser has no valid selection, it presents a redacted recoverable-round chooser; it never silently chooses the newest round. Local browser state is a draft/cache only and cannot overwrite a newer server revision without an explicit reconciliation action.

### D-02 — State vocabulary is user-facing and loss-aware

The UI uses distinct, text-backed states for saved, delivery-pending, delivered, delivery-uncertain, cancelled, and recovery-error. Each state includes the next safe action and preserves access to the exact round/result where the server contract permits it. Color, icon, or animation may supplement but never replace the state text or announcement.

### D-03 — Delivery acknowledgement gates closure

Submit transitions through the server’s durable delivery-pending and acknowledgement contract. Automatic tab closure is attempted only after a successful durable acknowledgement. If closure is denied by browser ownership policy, the UI remains usable and shows explicit safe-to-close guidance; uncertain acknowledgement never triggers closure.

### D-04 — Opening strategy is explicit and actionable

The browser/opening strategy is read from the validated Phase 10 settings contract. When the preferred browser/profile cannot be opened, the UI reports the attempted strategy and gives a copyable localhost URL plus the configured/manual next step. It must not expose executable host commands or change loopback binding.

### D-05 — Accessibility is a release criterion

Recovery and delivery status changes use live announcements, deterministic focus movement, keyboard-complete actions, and semantic state controls. Existing global question shortcuts are suspended while dialogs, recovery chooser, import/reconciliation, or delivery error surfaces own focus. Manual browser verification covers refresh/reconnect, private browsing, storage/quota failure, origin/port drift, narrow viewport, reduced motion, and assistive-technology-compatible keyboard flow.

## Discretion decisions

- Use the existing vendored React/Babel, local UI primitives, and CSS tokens; do not add a component library or production dependency.
- Prefer an explicit reconciliation panel with “keep server”, “review differences”, and “discard local draft” actions. Preserve both versions until the user chooses; never silently merge conflicting answer values.
- Model delivery uncertainty as a recoverable state with retry/status/result actions, not as success or cancellation.
- Keep round identifiers and diagnostics opaque and redacted; never render or log question/answer payloads in recovery metadata.

## Deferred

None. All roadmap success criteria and WEB-05–WEB-09 requirements are in scope.

## Existing Contracts to Preserve

- Phase 9 exact round selection, redacted recovery metadata, immutable result replay, and idempotent acknowledgement.
- Phase 10 effective settings ownership for browser launch, autosave/recovery, delivery, and post-submit closure.
- Node.js 18+, zero production dependencies, loopback-only bridge, existing React UMD/Babel runtime, and current accessibility test conventions.
