# Phase 10 — UI Review

**Audited:** 2026-07-17  
**Baseline:** `10-UI-SPEC.md`  
**Screenshots:** Not captured. Playwright CLI 1.61.1 was installed, but attempts against `http://127.0.0.1:4517/` produced no image files; documented browser checks remain human-needed.

## Advisory verdict

**BLOCKED for UI/accessibility sign-off.** The implementation has a labelled dialog and basic save guards, but it does not implement most of the Settings v2 browser contract. This is an advisory audit only; implementation code was not modified.

## Pillar Scores

| Pillar | Score | Key Finding |
|---|---:|---|
| 1. Copywriting | 1/4 | Several required labels and all import/reset/rollback copy are absent; existing save/error copy is non-contractual and generic. |
| 2. Visuals | 2/4 | A coherent modal primitive exists, but settings have no descriptions/effect badges/current-value treatment and the 40px FAB violates the 44px touch-target requirement. |
| 3. Color | 2/4 | Theme tokens are reused, but accent is applied to the settings chip and notices outside the reserved accent roles; contrast and high-contrast behavior were not browser-verified. |
| 4. Typography | 2/4 | Existing token-based typography is consistent, but labels/group headings use 12–14px where the contract requires explicit role treatment and body copy/descriptions are missing. |
| 5. Spacing | 2/4 | Several values are close to the scale, but 26px/18px/9px/6px/12px values are outside the declared scale and narrow overflow was not verified. |
| 6. Experience Design | 1/4 | Import/export/reset, validation preview, rollback, focus trap/return, live regions, and full state coverage are missing. |

**Overall: 10/24**

## Top 3 Priority Fixes

1. **Implement the complete Settings v2 flow** — users cannot import, preview, export, reset, or recover settings as specified — add the two-step preview/apply flow, namespace reset confirmation, deterministic export, validation/future-version states, and rollback messaging.
2. **Repair dialog keyboard and async accessibility** — users can lose focus or receive no assistive-technology outcome — add focus containment and trigger return, a visible close action, `role=status`/`role=alert` live regions, correct async Escape semantics, and first-invalid focus.
3. **Make every setting self-describing and touch-safe** — users cannot understand effects or reliably operate controls on touch/small screens — add descriptions, explicit current values, `Applies now/after reload`, correct single-choice semantics, and increase the FAB/control effective targets to at least 44×44px.

## Detailed Findings

### Pillar 1: Copywriting (1/4)

**BLOCKER:** `web/settings-panel.js:202` renders `Save failed — please try again.` instead of the required `Settings could not be saved. Your previous settings are still active. Try again.` It does not communicate preservation of the previous settings.

**WARNING:** `web/settings-panel.js:204-211` uses `Saved ✓`, `Cancel`, and `Save`; the contract requires `Settings saved.`, `Save settings`, and the documented reload notice. `web/settings-panel.js` contains none of the required Import/Export/Reset, preview, future-version, empty, destructive-confirmation, or rollback strings.

### Pillar 2: Visuals (2/4)

**WARNING:** `web/settings-panel.js:48-77` renders only a label and control. The contract requires a visible description, explicit current value, and effect text for each schema field.

**WARNING:** `web/styles.css:1238-1240` sets the always-visible FAB to `40px × 40px`, below the spec’s explicit 44px effective touch-target minimum.

**WARNING:** `web/settings-panel.js:180-182` has dialog labelling, but no visible close/cancel affordance separate from the footer and no focus trap. Return focus to the FAB is not implemented in `web/app.js:45-49`.

### Pillar 3: Color (2/4)

**WARNING:** `web/styles.css:1271`, `1359-1363`, and `1371-1373` use accent/success styling for the chip, reload/error notice, and saved status. The chip is decorative and the error notice is not a declared accent role; error should use the destructive/error treatment and status semantics.

**WARNING:** Theme tokens are correctly reused (`--surface-*`, `--accent`, `--success`), but the required 4.5:1 text / 3:1 non-text contrast across themes and high-contrast mode could not be verified without successful screenshots/browser inspection.

### Pillar 4: Typography (2/4)

**WARNING:** `web/styles.css:1267-1272` uses an 11px uppercase accent chip and `1277-1282` uses a 12px uppercase group title; `1308-1309` uses 12.5px controls. The spec defines body, label, heading, and display roles but the implementation omits the required explanatory body text and uses underspecified dense roles.

**WARNING:** The implementation does preserve existing font tokens for the chip (`--font-mono`) and inherits the app font, but no browser check confirmed font/theme coherence after changing Font settings.

### Pillar 5: Spacing (2/4)

**WARNING:** `web/styles.css:1261`, `1272`, `1275`, `1282`, `1289`, `1358`, and `1366-1377` use 26px, 18px, 10px, 9px, 6px, 20px, and 8px values. Some are valid near-scale values, but the modal’s 26px padding and repeated 18px/9px/6px rhythm do not follow the declared 4/8/16/24/32/48/64 scale.

**WARNING:** The modal has no explicit scroll container (`web/styles.css:1256-1265`) and no narrow-screen settings overflow treatment. The evidence artifact marks 320px/viewport overflow as manual-only.

### Pillar 6: Experience Design (1/4)

**BLOCKER:** The required import preview/apply, export, reset namespace confirmation, validation/future-version gating, rollback, empty state, and doctor/effective-settings views are absent from `web/settings-panel.js`.

**BLOCKER:** `web/settings-panel.js:94-109` installs a window capture listener with an empty dependency array. It closes through `cancel()` on Escape, but `cancel()` reads the render-time `isSaving` closure; Escape semantics during an in-flight save are therefore not reliably guarded. There is also no focus containment or return-to-FAB implementation.

**WARNING:** `web/settings-panel.js:199-204` renders reload/error/success messages without `role="status"`, `role="alert"`, or `aria-live`; asynchronous outcomes are not announced. The segmented controls at `:63-75` have no single-choice group semantics or selected-state ARIA.

**WARNING:** The source tests are mostly structural (`test/settings-panel.test.js:22-109`) and the committed evidence explicitly leaves active-round shortcuts, reload persistence, and viewport/contrast/reduced-motion as manual checks (`test/frontend-settings-evidence.md:6-14`). Focused tests pass, but they cannot prove mounted browser behavior.

## Browser verification status

- Server detected at `127.0.0.1:4517` (HTTP 200); ports 3000, 5173, and 8080 were unavailable.
- Playwright CLI 1.61.1 was present, but desktop/mobile/tablet/narrow screenshot commands produced no files. No visual claim is made from screenshots.
- Human-needed: active-round shortcut isolation, save/reload persistence, 320px and 1280px overflow, focus ring/contrast in all themes, reduced motion, focus trap/return, and async live-region announcements.

## Files Audited

- `.planning/phases/10-settings-v2/10-UI-SPEC.md`
- `.planning/phases/10-settings-v2/10-01-PLAN.md`, `10-02-PLAN.md`, `10-03-PLAN.md`
- `.planning/phases/10-settings-v2/10-01-SUMMARY.md`, `10-02-SUMMARY.md`, `10-03-SUMMARY.md`
- `web/settings-panel.js`, `web/app.js`, `web/settings-schema.js`, `web/index.html`, `web/styles.css`
- `test/settings-panel.test.js`, `test/views-a11y.test.js`, `test/views-a11y-recovery.test.js`, `test/browser-settings.test.js`, `test/frontend-settings-evidence.md`
- `server/server.js`
