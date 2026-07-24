---
phase: 19
slug: browser-lifecycle-recovery-corrections
status: approved
shadcn_initialized: false
preset: none
created: 2026-07-19
---

# Phase 19 — UI Design Contract

> Visual and interaction contract for browser lifecycle and recovery corrections. Existing decisions in `19-CONTEXT.md` are authoritative.

## Design System

| Property | Value |
|----------|-------|
| Tool | none — existing hand-authored CSS token system |
| Preset | not applicable |
| Component library | none; vendored React UMD + JSX, no build step |
| Icon library | existing inline SVG helpers in `web/ui-kit.js` (`Check`, `Brand`); no new icon dependency |
| Font | existing `Geist` / `Geist Mono`; theme overrides from `web/themes.js` remain supported |

The project has no `components.json`, shadcn registry, or external component library. Reuse the existing `.app`, `.stage`, `.qcard`, `.summary`, `.btn`, `.recovery-overlay`, `.recovery-panel`, and theme custom properties. Do not introduce a parallel visual system.

## Spacing Scale

Declared values (all phase additions use multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | icon/label gaps and compact metadata |
| sm | 8px | button gaps, metadata separation |
| md | 16px | default panel and control spacing |
| lg | 24px | panel padding and state-section spacing |
| xl | 32px | primary content gutters |
| 2xl | 48px | major shell separation |
| 3xl | 64px | desktop stage/page breathing room |

Exceptions: interactive controls retain a minimum 44px hit area where the existing UI already uses it; long recovery lists may scroll inside the existing max-height panel rather than expand the viewport.

## Typography

Use only these phase-contract roles and the active theme tokens:

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 16px | 400 | 1.5 |
| Label / secondary | 12px | 500 | 1.3 |
| Heading | 20px | 500 | 1.2 |
| Display | 32px | 500 | 1.16 |

Existing question-card display sizing may continue to clamp between 28px and 40px as already defined; lifecycle/recovery surfaces use the roles above. Do not use technical state names as headings.

## Color

Use theme tokens, with the default AMOLED values shown for the contract:

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `var(--bg)` / `#000000` | page background, retired shell background, overlay backdrop base |
| Secondary (30%) | `var(--surface-1)` / `#0a0a0a`, `var(--surface-2)` / `#131313` | sidebar, recovery panel, round choices, pending status surface |
| Accent (10%) | `var(--accent)` / `#4d8dff` | primary submit/continue action, selected exact round, keyboard focus ring, progress/current state |
| Destructive | existing `#f43f3f` treatment via `.btn--danger` | only explicit Cancel/Delete confirmation and delete action |

Accent reserved for: the normal `Submit answers` CTA, `Continue this exact round`, selected-round/focus indicators, current question/progress indicators, and the existing brand/check states. Do not use accent for passive reconnect, pending copy, technical metadata, or success/recovery banners. Success green remains reserved for existing answer-complete semantics; it is not a delivery success panel.

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | Normal flow: `Submit answers`; recovery: `Continue this exact round` |
| Empty state heading | `Waiting for a question…` |
| Empty state body | `A new round will appear here when the agent sends one.` |
| Error state | `We couldn't load a saved round right now.` Secondary guidance: `A new round can still appear here when the agent is ready.` |
| Destructive confirmation | `Delete this saved round?` / `This removes the retained round and cannot be undone.` Confirm: `Delete this round`; cancel: `Keep this round` |

Copy rules:

- Normal successful delivery has no success panel, toast, recovery copy, or technical status copy.
- Pending copy is quiet and human-readable: `Sending answers…`; never show `SSE`, `ack`, `bridge`, `window.close`, capability, round ID, or payload data in primary copy.
- Close-denied passive state: heading `This round is complete.` Body: `This tab is no longer waiting for new questions. You can close it when convenient.` Do not mention browser permissions or automatic-close failure.
- Interruption recovery heading: `A question round was interrupted.` Body: `Choose what to do with the saved round.`
- Uncertain delivery heading: `We couldn't confirm delivery.` Body: `Your answers are preserved. Continue this exact round to check again, cancel/delete it, or start a new round.`
- Technical state may appear only as small secondary text, for example `State: detached · Updated 2 minutes ago · 3 questions` or `Delivery status: uncertain`. Never include question text, answers, capabilities, or opaque payloads.
- Ordinary SSE/server reconnect has no user-visible message and must not open the recovery chooser.

## UI Considerations

Applicable state considerations resolved: 12 covered, 0 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | `waiting-shell` (`form`) | ✅ covered | No active round uses the existing one-column waiting shell and the documented waiting copy; it does not imply recovery. |
| loading | `recovery-chooser` (`list-collection`) | ✅ covered | While the redacted `/rounds` list is being checked, show a compact `Checking for saved rounds…` status in the same panel; do not show actions or question data. |
| error | `recovery-chooser` (`list-collection`) | ✅ covered | Failed recovery discovery uses the documented human-readable error and waiting guidance; it does not expose transport details or create a misleading success/recovery state. |
| populated | `recovery-round-list` (`list-collection`) | ✅ covered | Render only valid non-terminal recoverable records as redacted exact-round choices with state/time/question-count metadata. |
| partial | `delivery-pending-status` (`form`) | ✅ covered | Submit locks the form immediately while the existing summary remains visible; no answer is edited or submitted twice during delivery. |
| overflow | `recovery-round-list` (`list-collection`) | ✅ covered | More records scroll inside `.recovery-panel`; panel remains viewport-bounded and each choice keeps a full readable label. |
| zero-one-many | `recovery-round-list` (`list-collection`) | ✅ covered | Zero renders no chooser; one renders one selected-capable record; many require explicit exact-round selection and never infer the newest. |
| long-text | `recovery-copy` (`static-content`) | ✅ covered | Human-readable headings/body wrap normally; technical metadata is secondary and may wrap without clipping or exposing payload content. |
| loading | `ordinary-reconnect` (`nav`) | ✅ covered | EventSource reconnect is silent; the current screen, focus, and answer state remain stable while the generation/retirement guard handles callbacks. |
| populated | `active-question-form` (`form`) | ✅ covered | The existing two-column question/summarization layout remains the normal happy path, with no lifecycle banner added. |
| error | `uncertain-delivery-chooser` (`interactive-control`) | ✅ covered | Uncertain delivery uses the same exact-round chooser with only the three valid actions and no automatic close. |
| long-text | `recovery-actions` (`interactive-control`) | ✅ covered | Action labels wrap on narrow screens; controls retain 44px minimum hit areas and never truncate the verb that explains the outcome. |

## State and Transition Contract

The visual state is subordinate to exact round identity. A completed/retired tab may not accept a later SSE snapshot, remount `Flow`, or schedule another reconnect. Opaque answer objects remain data-only and are never rendered in recovery metadata.

| State | Layout and hierarchy | Actions and behavior |
|-------|----------------------|----------------------|
| Normal active question | Existing `.app` two-column shell: sidebar/progress plus centered `.qcard` or `.summary`; no overlay, toast, or recovery status. | Existing question navigation and keyboard semantics remain unchanged. `Submit answers` is the only delivery transition CTA. |
| Submit/delivery pending | Keep the current summary/question shell. Disable answer/navigation/submit controls; show one quiet inline `role="status"` message `Sending answers…` near the disabled submit control. Do not use `.toast--err`, a modal, or recovery copy. | On submit start, call the live subscription retirement boundary immediately for the owning round. Keep acknowledgement in-flight; do not render later rounds or permit duplicate submit. |
| Successful delivery acknowledged | With closure mode `after-delivery` (the default), render no intermediate success UI and attempt close directly after acknowledgement. With the preserved manual/no-close setting, keep the terminal tab inert without adding a success panel. | A successful acknowledgement is the only final close boundary. The delivered record is terminal and must never be returned by recovery discovery. |
| Close denied | Replace the active shell with a quiet single-column `.app--retired` passive state using the documented complete copy. No alert role, warning icon, recovery chooser, retry, or new-round action. | The tab remains permanently retired and ineligible for all later rounds even if physically open. It may be manually closed by the user. |
| Actual interruption recovery | Use the existing centered `.recovery-overlay` / `.recovery-panel` over the one-column waiting shell. Heading/body are human language; each redacted record is a selectable exact-round choice. Technical state is small secondary text. | The chooser exposes exactly: `Continue this exact round` (primary), `Cancel/Delete it` (destructive, confirmation required), and `Start a new round` (secondary, leaves retained data intact unless separately deleted). Selection always carries the exact `roundId`/selector. |
| Uncertain delivery recovery | Keep the same panel hierarchy but use the uncertain-delivery heading/body. Do not close the tab or show a success toast. | `Continue this exact round` retries the exact round's valid delivery/recovery path; `Cancel/Delete it` confirms before removing the retained record; `Start a new round` does not silently discard the uncertain record. |
| Ordinary SSE/server reconnect | No visible surface, layout shift, alert, toast, spinner, or recovery dialog. Existing screen and focus remain stable. | `EventSource.onerror` may reconnect using the existing backoff, but reconnect alone never changes the UI into recovery. Retired tabs do not reconnect. |

### Recovery chooser interaction details

- The chooser is rendered only when the bridge has a real recoverable record: interrupted/detached/reconnecting round or genuinely uncertain delivery. Terminal `delivered` records are filtered before the UI receives them.
- Multiple records are shown as redacted choices. A choice displays a human label plus small metadata (`State`, relative update time, question count); it never displays question text, answer text, capability, filesystem path, or raw diagnostic payload.
- The action row is unavailable until an exact record is selected. The primary action resumes only that record; it must not choose the newest record implicitly.
- `Cancel/Delete it` opens a confirmation dialog using the existing modal focus/escape conventions. The confirmation is the only destructive safeguard; cancellation keeps the record.
- `Start a new round` dismisses recovery without deleting the retained record and leaves the app waiting for a host-created round. It must not masquerade as successful recovery.
- Recovery discovery loading/error is not a recovery choice and must not expose a technical-details action. Ordinary reconnect remains silent.

## Component and File Ownership

| Existing file | Exact ownership for this phase |
|--------------|--------------------------------|
| `web/live.js` | Own SSE generation/reconnect lifecycle and a permanent per-tab retirement guard. Retired state gates `onmessage`, `onerror`, reconnect timers, and later snapshots. Keep `acknowledgeDelivery`, `attemptClose`, and exact-round transport semantics; no answer-payload rendering. |
| `web/app.js` | Own the browser state machine: retire at submit start, keep pending UI quiet, close only after successful acknowledgement, route uncertain/interrupted states to recovery, and prevent delivered rounds from recovery state. Read the v2 closure setting so `after-delivery` is the default while the explicit no-close setting remains respected. Remove the normal success toast/delivery panel path. |
| `web/views.js` | Own presentational `RecoveryChooser` and delivery/retired-state views. Preserve dialog labelling, focus restoration, keyboard trap, native button semantics, live status, and redacted metadata. Recovery labels/actions must match this contract exactly. |
| `web/styles.css` | Extend existing token-based `.recovery-*`, `.delivery-*`, `.btn`, and responsive shell rules. Add a quiet retired state and pending inline treatment without introducing new colors, gradients, fonts, or a second overlay model. Respect all theme tokens and reduced-motion rules. |
| `web/ui-kit.js` | Reuse existing decorative `Check`/`Brand` only when helpful; no new icon library or technical-status iconography. |
| `web/themes.js` | No new theme contract; lifecycle/recovery surfaces must inherit `KNOWN_TOKENS` and remain legible in AMOLED, Paper, Phosphor, Dusk, Aurora, and high-contrast settings. |
| `web/settings-schema.js` | Change the v2 `closure.mode` schema default from `never` to `after-delivery`, while preserving `never` as the explicit no-close/manual override. Keep the existing `closure.mode` choices and normalized settings contract intact for browser/runtime consumers. |
| `web/answer-map.js` | No UI ownership change. Preserve opaque answer mapping and question-type behavior. Recovery must not inspect or display mapped answers. |
| `test/live.test.js` | Verify retirement acceptance, silent reconnect behavior, acknowledgement/close sequencing, denied-close result, and delivery-uncertain transitions. |
| `test/app-state.test.js` | Verify pending/delivered/retired/recovery UI source contracts and closure setting default/override behavior. |
| `test/views-a11y-recovery.test.js`, `test/views-a11y.test.js` | Verify dialog names/descriptions, focus target/trap, live status, button types, destructive confirmation, and no payload-bearing copy. |
| `test/browser-recovery-e2e.test.js` | Verify active vs waiting shell, no recovery on normal completion/reconnect, exact three recovery actions, redaction, and narrow viewport behavior. |
| `test/settings-schema.test.js` | Regression coverage must assert fresh v2 settings default `closure.mode` to `after-delivery` and preserve explicit `never` as the no-close/manual override. |
| `test/server.test.js`, `test/bridge.test.js` | Verify terminal delivered records are excluded from `/rounds` while interrupted and uncertain records remain selectable; these are supporting REC/TAB contract tests, not new UI surfaces. |

## Accessibility Requirements

- Recovery chooser uses `role="dialog"`, `aria-modal="true"`, a unique `aria-labelledby`, and an `aria-describedby` pointing to the human-readable explanation. Focus moves to the heading or first meaningful control and returns to the invoking control when the chooser closes.
- Keep a keyboard focus trap while the chooser/confirmation is open. `Escape` dismisses only a non-destructive chooser or the confirmation; it must not silently delete a retained round.
- Use native `button type="button"` controls. Recovery choices expose selected state with `aria-pressed` or an equivalent labelled selection pattern; the selected exact round and action availability are announced.
- Pending and uncertain status use `role="status"` / `aria-live="polite"`; close denial is passive text, never `role="alert"`. Ordinary reconnect emits no live-region update.
- Preserve the existing `aria-current="step"`, question-card live region, keyboard shortcuts, reduced-motion behavior, and focus-visible styling. Do not steal focus when silently reconnecting or while a normal round is submitted.
- Primary copy must remain understandable without technical knowledge. Secondary metadata can be visually smaller but must maintain readable contrast and wrap on narrow screens.
- Destructive confirmation must name the exact consequence and provide a non-destructive escape. No recovery action may reveal opaque capabilities, round payloads, or question/answer contents to assistive technology.

## Responsive Behavior

- Desktop/tablet: recovery panel is centered, max-width 620px, max-height viewport-bounded with internal scrolling; action row uses the existing button hierarchy and 16px gaps.
- Mobile (`max-width: 760px`): retain the one-column waiting shell; panel width is viewport minus 20px, padding is 16px, list choices stack, and actions become full-width in priority order: Continue, Cancel/Delete, Start a new round.
- Very narrow screens: long headings and action labels wrap; never truncate `Continue this exact round` or `Start a new round`. Keep 44px minimum target height and visible focus rings.
- The retired passive state is centered with at least 24px side padding and no fixed-height content that can clip localized or wrapped copy.
- `prefers-reduced-motion` and the existing `data-reduce-motion` setting remove transition/animation enhancements; lifecycle correctness and status timing do not depend on motion.

## Acceptance Criteria

### TAB-01 — acknowledged delivery closes the owning tab

- Given a round is active and the settings schema default resolves `closure.mode` to `after-delivery`, when the user submits and the acknowledgement succeeds, then the owning tab renders no success/recovery surface and attempts direct close exactly after acknowledgement.
- Given acknowledgement is pending, when SSE/server reconnects or a later round is created, then the submitting tab remains retired from later updates and shows only the quiet pending state until acknowledgement settles.
- Given `window.close()` is denied, then the tab shows only `This round is complete.` and its passive guidance; it does not show a technical warning, retry, recovery chooser, or later round.
- Given the explicit `never` no-close/manual override is selected, successful acknowledgement still produces no success toast/panel and the tab remains terminal/ineligible for later rounds.
- Given a fresh v2 settings envelope is created, then `web/settings-schema.js` supplies `closure.mode: after-delivery` by default, while an explicit `closure.mode: never` value remains valid and is preserved through normalization.

### TAB-02 — no duplicate completed tab

- Given round A is acknowledged and its tab is physically still open, when round B is opened, then only the new owning tab renders round B; the retired round-A tab ignores the snapshot and does not remount `Flow`.
- Given an old EventSource callback or reconnect timer fires after retirement, then it has no visible effect and cannot schedule a new reconnect loop.
- Given the same round snapshot is replayed before retirement, then existing answer state remains stable; only a different, eligible round may create a new active flow.

### REC-01 — recovery only for genuinely recoverable state

- Given a normal successful delivery/acknowledgement or ordinary SSE reconnect, then no recovery chooser, recovery toast, or local-server warning appears.
- Given an interrupted/detached/reconnecting record exists, then the chooser appears with redacted exact-round metadata and no implicit newest-round selection.
- Given a `delivered` terminal record exists alongside an interrupted record, then only the interrupted record is listed.
- Given delivery is uncertain, then the result remains recoverable and the chooser does not auto-close the tab.

### REC-02 — clear valid recovery actions

- The chooser exposes exactly `Continue this exact round`, `Cancel/Delete it`, and `Start a new round`; no technical-details action, raw state dump, `Retry recovery`, or ambiguous `Continue without recovery` label appears in the normal chooser.
- Continue operates on the explicitly selected round; Cancel/Delete requires confirmation; Start a new round leaves the retained record intact unless the user separately deletes it.
- Primary copy explains the interruption or uncertainty in human language. State names/timestamps/counts are secondary metadata only, and question/answer payloads are never shown.
- The chooser, confirmation, pending status, and passive close-denied state are keyboard reachable, screen-reader labelled, focus-safe, responsive, theme-aware, and readable with reduced motion.

## Edge Cases

- A second SSE tab receives a later snapshot while the first tab is pending: the first tab's retirement guard wins; no duplicate flow is rendered.
- Acknowledgement succeeds after a transient network error: transition to delivered, close according to setting, and never re-open recovery for that terminal round.
- Acknowledgement fails or times out after answer submission: transition to uncertain, preserve the exact round, do not close, and offer the three recovery actions.
- Recovery selection races with expiry, cancellation, or another owner: keep the chooser human-readable, preserve the current screen, and surface the existing safe recovery error without payload or technical-detail action.
- Zero, one, or many recoverable records: render no chooser, one exact choice, or an explicitly selectable list respectively; never select by recency.
- Long state/time labels, localized copy, small viewport, high contrast, alternate themes, and reduced motion must not clip, hide, or reorder the three actions.
- A stale old-tab callback must not clear a new tab's state, reopen recovery, or alter the current round identity.

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| none | none | not applicable; no shadcn or third-party registry is present |

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved
