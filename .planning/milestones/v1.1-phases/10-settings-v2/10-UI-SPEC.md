---
phase: 10
slug: settings-v2
status: draft
shadcn_initialized: false
preset: none
created: 2026-07-17
---

# Phase 10 — UI Design Contract

> Visual and interaction contract for the Settings v2 browser experience. The existing vendored React + CSS UI is the source of truth; no new component library is introduced.

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | existing local primitives in `web/ui-kit.js`, `web/settings-panel.js`, and `web/styles.css` |
| Icon library | inline SVG, decorative icons `aria-hidden="true"` |
| Font | existing theme-controlled `--font-sans` / `--font-mono` tokens |

Preserve the current modal overlay, surface tokens, button tokens, theme variables, and schema-driven rendering. Settings are a local, single-user product surface; imported data must never expose executable host commands, loopback binding, or adapter command strings.

## Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | icon gaps, badge gaps, segmented-control internal gaps |
| sm | 8px | compact control padding, help text spacing |
| md | 16px | setting-row gaps, control-group padding |
| lg | 24px | modal/card padding and namespace separation |
| xl | 32px | page section gaps and import/export separation |
| 2xl | 48px | major page-level breaks |
| 3xl | 64px | wide-screen page breathing room |

Exceptions: all interactive controls, including the 40px settings FAB, must provide at least a 44px by 44px effective touch target; dense text inside may remain 12–14px. On narrow screens the settings surface may scroll vertically, but controls must not be clipped or require horizontal scrolling.

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 16px | 400 | 1.5 |
| Label | 14px | 400 | 1.5 |
| Heading | 20px | 600 | 1.2 |
| Display | 28px | 600 | 1.2 |

Use existing font tokens so Theme, Font, and high-contrast settings remain coherent. Do not communicate state with weight or color alone; pair it with text, icon, `aria-*`, or a live announcement.

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | existing theme `--bg` / `--surface-1` | page background, modal background, primary reading surface |
| Secondary (30%) | existing `--surface-2` / `--surface-3` | setting controls, cards, grouped panels, navigation affordances |
| Accent (10%) | existing `--accent`, including selected-control tokens | primary Save/Import action, active segmented option, focus ring, success status |
| Destructive | existing `--danger` token | Reset namespace, discard/rollback confirmation, destructive error state only |

Accent reserved for: the primary action, selected values, keyboard focus indication, links that perform navigation, and successful save/import confirmation. Do not use accent as a general decoration or for every interactive affordance. Preserve theme and high-contrast overrides with a minimum 3:1 non-text UI contrast and 4.5:1 normal text contrast.

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | `Save settings` |
| Import CTA | `Preview import` |
| Export CTA | `Export settings` |
| Reset CTA | `Reset {namespace}` |
| Empty state heading | `No settings file found` |
| Empty state body | `Defaults are active. Save a setting or import a file to create your local settings.` |
| Import preview | `Review these changes before applying them.` |
| Import validation error | `This file cannot be imported. Fix the highlighted settings and try again.` |
| Future-version error | `This settings file was created by a newer version. Update AskUserQuestionsPro before importing it.` |
| Save error | `Settings could not be saved. Your previous settings are still active. Try again.` |
| Save success | `Settings saved.` |
| Reload notice | `Reload the page to apply changes marked “on reload”.` |
| Destructive confirmation | `Reset {namespace}? This removes those saved choices and restores defaults. This cannot be undone.` |
| Rollback confirmation | `Import was not applied. Your previous settings are still active.` |

Use specific namespace names in place of `{namespace}` (for example, `Recovery`). Never say only “Something went wrong.” Errors must explain whether the old settings remain active and the next action.

## UI Considerations

Applicable state considerations resolved: 11 covered, 1 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | settings file / import history | ✅ covered | Show the documented no-file copy; defaults remain visibly active and no destructive action is implied. |
| loading | save, import preview, export, doctor | ✅ covered | Disable the initiating action, retain its label with an ellipsis (`Saving…`, `Validating…`, `Exporting…`), and expose busy state to assistive technology. |
| error | save, parse, schema validation, future version, export | ✅ covered | Use the documented problem + next-step copy in an inline alert adjacent to the affected action; preserve prior effective settings. |
| populated | namespaces and schema controls | ✅ covered | Render schema labels, descriptions, current values, and live/reload effect labels in stable group order. |
| partial | import preview | ✅ covered | Show added, changed, unchanged, ignored, and invalid entries; Apply remains disabled until the complete payload validates. |
| overflow | long namespace lists, validation details, narrow viewport | ✅ covered | Modal/page content scrolls vertically, focus remains inside the active dialog, long values wrap or use a disclosed code/details block, and no horizontal clipping occurs. |
| zero-one-many | reset namespaces and import changes | ✅ covered | One namespace uses singular copy; many use a summary count plus expandable details; zero offers no-op feedback rather than a disabled unexplained button. |
| long-text | imported values, paths, diagnostics | ✅ covered | Wrap visible text, use `<code>`/details for raw values, and provide a full accessible name/description without truncating meaning. |
| rollback | import apply failure or cancel | ✅ covered | Atomic apply preserves the previous snapshot; show rollback copy and return focus to the import action. |
| persistence | save, reload, upgrade/migration | ✅ covered | After save, show the persisted effective values and a status announcement; after reload/migration, show a non-blocking migration/backup result with recovery guidance. |
| keyboard | modal, controls, preview, confirmation | 🧪 backstop | Automated/source and manual keyboard verification must prove Tab containment, Escape semantics, Enter activation, return focus, and no keyboard trap in scrollable content. |
| destructive | reset namespace, discard import | ✅ covered | Require an explicit confirmation dialog; never confirm by backdrop click or Escape. |

### Required screen and interaction states

- The always-visible Settings FAB opens a named modal/dialog and returns focus to the FAB on close. The dialog has a heading, description, `aria-modal="true"`, and a visible close/cancel action. Escape closes only when no save/import/confirmation request is in flight.
- The main settings view is grouped by namespace. Each control has a visible label, an explicit current value, a concise description, and an effect badge/text (`Applies now` or `Applies after reload`). Existing select segments remain one logical single-choice group; toggles retain `role="switch"` and accurate `aria-checked`.
- Editing a live setting previews it immediately. Cancel restores the last saved baseline; Save persists the complete validated object, prevents double submission, and announces success. A failed save leaves the previous effective settings intact and leaves retry available.
- Import is a two-step flow: choose/read a local JSON file, then show a preview before application. Preview must identify schema version, migration/backup outcome, changed keys by namespace, ignored unknown keys, and validation errors. No partial import is ever applied.
- Export is read-only and gives a deterministic JSON download/export result without sensitive values or executable host configuration. If export fails, show an inline retryable error and do not change settings.
- Reset is namespace-scoped. Show the exact affected namespace and count, require confirmation, apply atomically, and announce completion. If reset fails, show the documented save error and preserve the old values.
- Doctor/effective-settings view is read-only, grouped, copyable, and explicitly labels non-sensitive values; never render raw question/answer content, secrets, host commands, or loopback/security controls.

### Accessibility requirements

- Use a real dialog structure (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and `aria-describedby`) and a focus trap that includes all enabled controls in the scrollable content. On open, focus the dialog heading or first actionable control; on close, restore focus to the trigger.
- All buttons have `type="button"` unless they intentionally submit a form. Icon-only controls have an accessible name. Decorative SVGs are hidden from the accessibility tree.
- Status messages use `role="status"` / `aria-live="polite"`; validation and save failures use `role="alert"` / `aria-live="assertive"`. Do not rely on color, disabled styling, or a toast alone to communicate outcome.
- Import preview errors are associated with their field/row via `aria-describedby`; the first invalid item receives focus when validation completes. Apply is disabled for invalid or incomplete previews, with an adjacent explanation that remains available to screen readers.
- Keyboard behavior: Tab/Shift+Tab cycle within the active dialog; Escape cancels the current non-destructive view; Enter activates the focused button/control; segmented controls are keyboard reachable; no global question shortcut steals keystrokes from text inputs, file inputs, or dialogs.
- Focus indicators use the existing focus token and remain visible in every theme, high-contrast mode, and reduced-motion mode. Do not use animation as the only indication of a state change; honor `prefers-reduced-motion` and the persisted Reduce motion setting.
- Test persisted values by reload and upgrade/migration fixtures, including defaults after invalid data, unsupported future-version rejection, import rollback, and keyboard-only navigation. Preserve the existing source-level accessibility regression tests and add coverage for the new dialog/status/import controls.

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| none | none | not applicable; no third-party registry or remote component code |

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
