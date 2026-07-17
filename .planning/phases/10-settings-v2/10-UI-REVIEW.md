# Phase 10 — UI Review

**Audited:** 2026-07-17 (HEAD `85eff54`)
**Baseline:** `10-UI-SPEC.md`
**Screenshots:** CLI screenshot commands were executed, but `test/artifacts/settings-v2-cli/screenshots/` contains no image files. Visual findings below are therefore code/evidence based; no screenshot-derived visual claim is made.

## Advisory verdict

**BLOCKED for final UI/accessibility sign-off.** The final fixes resolve the earlier dialog, focus, save-guard, status-semantics, touch-target, settings-row description, persistence, reduced-motion, and narrow-scroll findings. The browser surface still does not expose the contract’s import preview/apply, export, namespace reset confirmation, empty state, rollback, or doctor/effective-settings views. The automated CLI evidence proves only the implemented subset and cannot compensate for those missing flows.

## Pillar Scores

| Pillar | Score | Key Finding |
|---|---:|---|
| 1. Copywriting | 2/4 | Save, reload, and save-error copy now match the contract, but import/export/reset/empty/rollback/future-version UI copy is absent. |
| 2. Visuals | 3/4 | Settings rows now provide descriptions, current values, and effect labels; the modal scrolls and the FAB is 44px, but the required secondary flows and their visual states do not exist. |
| 3. Color | 3/4 | Theme tokens and selected/focus/status treatments are reused, but accent is still used broadly for the settings chip, notices, and active controls; contrast across every theme was not screenshot-verified. |
| 4. Typography | 2/4 | Font tokens are preserved and core labels are readable, but the settings surface uses 11px/12px/12.5px dense roles and generic generated descriptions rather than the contract’s explicit body/label/heading hierarchy. |
| 5. Spacing | 2/4 | Narrow scrolling and 44px controls are present, but modal padding 26px, row padding 9px, 18px/10px/6px rhythms, and 12px/4px control spacing do not consistently follow the declared 4/8/16/24/32/48/64 scale. |
| 6. Experience Design | 2/4 | Automated evidence proves focus containment/return, persistence, reduced motion, future-version refusal, and narrow vertical scrolling; the major import/export/reset/rollback/doctor states remain missing. |

**Overall: 14/24**

## Top 3 Priority Fixes

1. **Add the complete browser settings flow** — users cannot perform the core Phase 10 settings tasks — add `Preview import` with changed/unchanged/ignored/invalid detail, `Export settings`, namespace reset confirmation, empty/default state, rollback, and read-only doctor/effective-settings UI.
2. **Connect the missing async states to the contract** — users cannot understand or recover from import/reset/export outcomes — add the exact loading labels, documented validation/future-version/rollback copy, disabled Apply gating, focus/error association, and atomic failure announcements.
3. **Finish visual contract conformance and human verification** — typography/spacing/accent distribution remain advisory risks — replace off-scale settings rhythm with the declared tokens, reserve accent to contract roles, and capture inspectable desktop/mobile/high-contrast/reduced-motion screenshots for final visual sign-off.

## Detailed Findings

### Pillar 1: Copywriting (2/4)

**PASS (automated/source):** `web/settings-panel.js:213-223` includes `Reload the page for this to fully take effect.`, `Settings could not be saved. Your previous settings are still active. Try again.`, `Settings saved.`, and `Save settings`; save loading is labelled `Saving…`.

**WARNING:** `web/settings-panel.js:51-52` generates the generic description `Configure {label} for this round.` rather than schema-specific explanatory copy. The file has no `Preview import`, `Export settings`, `Reset {namespace}`, `No settings file found`, import preview, future-version, destructive-confirmation, or rollback UI copy. Those requirements are explicit in `10-UI-SPEC.md:67-79`.

### Pillar 2: Visuals (3/4)

**PASS (automated/source):** `web/settings-panel.js:48-52` renders label, description, current value, and effect text for every schema entry. `web/styles.css:1233-1247` makes the FAB 44px by 44px, and `web/styles.css:1256-1266` provides a bounded vertically scrolling modal. `npm run test:browser` also passed the 320px scroll assertion.

**WARNING:** The missing import/export/reset/doctor flows mean there is no visual hierarchy or state treatment to audit for the core secondary tasks. Screenshot files were not actually produced, so desktop/mobile composition, clipping, and theme appearance remain human-only/unverified.

### Pillar 3: Color (3/4)

**PASS (source):** `web/styles.css:1242-1246`, `1313-1331`, and `1358-1364` reuse surface, border, accent, and accent-foreground theme tokens for the FAB, segmented selected state, and switch state.

**WARNING:** `web/styles.css:1276-1282` uses accent for the decorative Settings chip, while `web/styles.css:1367-1373` uses accent styling for the general notice container. The contract reserves accent for primary action, selected values, focus, navigation links, and success confirmation; a destructive/error surface should use the danger treatment. Contrast in all themes/high-contrast mode is not a true human visual pass because no screenshots were generated.

### Pillar 4: Typography (2/4)

**PASS:** The modal inherits the existing theme-controlled font tokens; labels are 14px at `web/styles.css:1301-1304`, and controls retain readable text.

**WARNING:** Settings-specific roles use 11px chip text (`web/styles.css:1276-1282`), 12px group titles (`1287-1292`), 12.5px segmented controls/notices/status (`1313-1321`, `1367-1384`), and 0.72rem effect text (`1271-1272`). This can be acceptable for dense metadata, but the surface has no explicit 16px body or 20px heading treatment as required by the contract, and the generated descriptions are not meaningful product copy.

### Pillar 5: Spacing (2/4)

**PASS (automated/source):** `web/styles.css:1258-1265` constrains modal height and enables vertical overflow; the browser CLI assertion passed at 320px. The close button is at least 44px high (`1268-1269`).

**WARNING:** `web/styles.css:1263` uses 26px modal padding; `1282`, `1285`, `1292`, `1299`, `1368`, and `1376` use 18px/10px/9px/6px/20px values; `1309`, `1318`, and `1373` use 4px/6px/9px control rhythms. These do not consistently use the declared spacing scale. No screenshot artifact proves that the resulting layout is free of visual crowding at desktop and narrow widths.

### Pillar 6: Experience Design (2/4)

**PASS (automated CLI evidence):** `test/artifacts/settings-v2-cli/commands.log` records `ASSERTIONS: PASS` for opening a labelled dialog, initial focus on Close, Tab containment, Escape close and return focus to Settings, high-contrast/reduce-motion persistence after reload, future-version rejection without default mutation, and 320px vertical scroll. `test/views-a11y.test.js`, `test/views-a11y-recovery.test.js`, and `test/settings-panel.test.js` all passed; the focused run reported 23/23 passing.

**PASS (source):** `web/settings-panel.js:100-122` contains Escape guarding, Tab containment, focus initialization, and abort cleanup; `193-223` supplies dialog semantics, status/alert live regions, save guards, and documented save outcomes. `web/app.js:45-50` returns focus to the FAB.

**BLOCKER:** `web/settings-panel.js` still has no import file/preview/apply flow, export action, namespace reset confirmation, empty state, rollback state, or doctor/effective-settings view. These are required by `10-UI-SPEC.md:89-111` and cannot be inferred from the passing save/focus assertions. `test/frontend-settings-evidence.md` lists the host adapter check as `MANUAL CHECK`; no automated evidence covers the absent browser flows.

## Evidence Classification

### Automated CLI/browser evidence

- `npm run test:browser` passed on HEAD.
- `test/artifacts/settings-v2-cli/commands.log` exists and ends with `ASSERTIONS: PASS`.
- The command log records the browser interactions and evaluations described under Pillar 6.
- `test/artifacts/settings-v2-cli/screenshots/settings-cli.png` and `settings-cli-narrow.png` were requested by the script but do not exist; they are not evidence.
- Focused accessibility/source run: 23 tests passed across `test/views-a11y.test.js`, `test/views-a11y-recovery.test.js`, `test/settings-panel.test.js`, and `test/browser-settings.test.js`.

### Human-only or not proven by the artifacts

- Visual composition, hierarchy, 60/30/10 color distribution, contrast across every theme, focus-ring appearance, typography feel, and reduced-motion appearance cannot be signed off from the missing screenshots.
- Host adapter live acceptance remains explicitly manual in `test/frontend-settings-evidence.md`.
- Import/export/reset/rollback/doctor browser behavior is not merely human-only; the corresponding UI controls and states are absent from the implementation.

## Registry Safety

Registry audit: not applicable. `10-UI-SPEC.md` declares no third-party registries and `components.json` is not present.

## Files Audited

- `.planning/phases/10-settings-v2/10-UI-SPEC.md`
- `.planning/phases/10-settings-v2/10-01-PLAN.md` through `10-04-GAP-PLAN.md`
- `.planning/phases/10-settings-v2/10-01-SUMMARY.md` through `10-04-SUMMARY.md`
- `web/settings-panel.js`, `web/app.js`, `web/settings-schema.js`, `web/styles.css`, `web/index.html`
- `test/browser-settings-cli-e2e.js`
- `test/browser-settings-e2e.test.js`, `test/browser-settings.test.js`, `test/settings-panel.test.js`
- `test/views-a11y.test.js`, `test/views-a11y-recovery.test.js`, `test/frontend-settings-evidence.md`
- `test/artifacts/settings-v2-cli/commands.log` and screenshot directory contents
