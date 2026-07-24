# Phase 15: Browser Visual & Accessibility QA - Research

**Researched:** 2026-07-18
**Domain:** Browser visual, responsive, keyboard, focus, and accessibility QA for settings, recovery, reconciliation, and delivery flows
**Confidence:** HIGH for repository behavior and implementation seams; MEDIUM for live-browser evidence because the Playwright Node package and assistive technology are unavailable locally.

## User Constraints

- Scope is implementation-ready guidance for UI-01 and UI-02.
- Inspect settings, recovery, and delivery screens, including exact recovery routes, draft reconciliation, acknowledgement-before-close/fallback, responsive behavior, keyboard behavior, and evidence artifacts.
- Preserve the observed live-browser facts: at 1512px the waiting screen has only `.inspector` but `.app` computes `362.875px 1149.12px`, causing one-word-per-line wrapping; the live question screen is readable; at 390x844 options/settings scroll internally; Dusk cancel restored `data-theme=amoled`; scale ArrowUp+Enter advanced; Keep server worked; delivery reached exact recovery and Continue without recovery returned to waiting.
- Inspect only; do not change product code during research.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | Settings, recovery, and delivery screens receive a current browser visual/accessibility review with screenshots or an explicit unavailable-evidence record. | Existing UI contracts, live observations, archived UAT gaps, evidence matrix, and screenshot/unavailable-record guidance below. |
| UI-02 | Browser smoke verifies exact recovery selection, draft reconciliation, delivery acknowledgement-before-close, keyboard/focus ownership, and actionable fallback behavior. | Exact route/state map, focused test seams, manual browser scenarios, and external-gap boundaries below. |

## Summary

The current implementation already has the intended lifecycle contract: recovery is explicit and round-specific, draft conflicts surface a reconciliation dialog, delivery is text-backed and acknowledgement-gated, and denied close preserves the delivered result. [VERIFIED: codebase read `web/app.js`, `web/views.js`, `web/live.js`] The archived Phase 11 UAT records the same behavior as automated-pass, while real-browser ownership denial, screen-reader output, private-mode quota failure, origin drift, opener failure, and visual screenshots remain unverified. [VERIFIED: `.planning/milestones/v1.1-phases/11-browser-recovery-delivery-ux/11-UAT.md`]

The concrete visual defect is the idle shell: `App` renders a `.app` containing only `Waiting`, but `.app` always uses two desktop grid columns for sidebar plus inspector. [VERIFIED: `web/app.js`, `web/styles.css`] At 1512px this leaves an empty first column and makes the waiting heading wrap unnaturally. Use an explicit no-sidebar/waiting shell state that sets a single grid column; add a focused regression that checks the waiting shell contract and prevents the generic two-column rule from returning. [VERIFIED: live observation supplied by user; implementation recommendation based on codebase]

**Primary recommendation:** Keep the existing vendored React/CSS architecture, fix idle layout with an explicit `.app--waiting` (or equivalent) single-column state, then extend the existing browser CLI/manual evidence matrix rather than adding a UI dependency.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Waiting/question layout and responsive CSS | Browser / Client | — | React views and `web/styles.css` own composition, grid, overflow, and viewport behavior. [VERIFIED: codebase read] |
| Settings modal and persistence feedback | Browser / Client | API / Backend | Browser controls/focus live in `web/settings-panel.js`; persistence contracts are served by the local bridge. [VERIFIED: codebase read] |
| Exact recovery selection | Browser / Client | API / Backend | Browser chooses the opaque selector; bridge validates/resumes the durable round. [VERIFIED: `web/live.js`, Phase 11 UAT] |
| Draft reconciliation | Browser / Client | Database / Storage | Browser presents the revision conflict and applies the server-authoritative choice; durable draft/revision state is bridge-owned. [VERIFIED: `web/app.js`, Phase 11 summary] |
| Delivery acknowledgement and close fallback | Browser / Client | API / Backend | Browser orders POST answer → acknowledgement → optional close; server owns durable delivery state. [VERIFIED: `web/app.js`, `web/live.js`, Phase 11 UAT] |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Native browser DOM/CSS | Browser runtime | Layout, focus, dialog semantics, responsive overflow | Existing product surface has no frontend build or UI dependency. [VERIFIED: `.planning/codebase/STACK.md`] |
| Vendored React/ReactDOM | Repository-vendored | Render browser state and views | Existing `web/index.html` load path; do not introduce a runtime dependency for QA. [VERIFIED: `.planning/codebase/STACK.md`] |
| Native `node:test` | Node >=18 project baseline | Source-contract and regression tests | Existing test runner and focused suites. [VERIFIED: `package.json`, local command] |

### Supporting

| Tool | Version/status | Purpose | When to Use |
|------|----------------|---------|-------------|
| `npm run test:browser` | Existing script | Isolated browser CLI smoke for settings and narrow viewport behavior | Run when the CLI/browser harness is available; preserve artifacts when evidence is needed. [VERIFIED: `package.json`, Phase 11 UAT] |
| Playwright Node package | Not available locally | Executable browser evidence | Install/use only in a dedicated evidence environment; current test skips without it. [VERIFIED: focused command] |

**Installation:** No new production package is recommended. [VERIFIED: project constraints]

## Architecture Patterns

### Exact recovery route

`GET /rounds` → render redacted choices → user clicks one exact `roundId`/`requestId` → `POST /resume` with that selector → retain error and current work if resume fails. Never infer “newest” in the browser. [VERIFIED: `web/live.js`, Phase 11 UAT]

### Draft reconciliation

When server and local revisions differ, keep both revisions visible until an explicit action. `Keep server` and `Discard local draft` are currently wired to the server-authoritative draft application; the dialog announces revision numbers and says nothing was overwritten. [VERIFIED: `web/app.js`, `web/views.js`, Phase 11 summary] Browser smoke should assert the dialog, action, replacement, and return to the question surface.

### Delivery state machine

`drafting` → `delivery-pending` → POST answer → durable acknowledgement → `delivered` → optional close. Ack failure becomes `delivery-uncertain`; server rejection becomes `recovery-error`; neither path auto-closes or discards the result. [VERIFIED: `web/app.js`, `web/live.js`]

### Idle-shell fix

Add an explicit waiting/no-sidebar class at the `App` shell boundary and set its grid to `1fr`; retain the normal two-column rule for live question screens and the existing mobile single-column media rule. Avoid a global `.app { grid-template-columns: 1fr; }`, which would remove the sidebar from active rounds. [VERIFIED: `web/app.js`, `web/styles.css`; recommendation]

## Focused Browser/A11y Regression

Add a focused test near `test/browser-recovery-e2e.test.js` or a dedicated `test/browser-visual-a11y.test.js` covering the source contract and, when browser tooling exists, the live DOM:

- Waiting render has an explicit no-sidebar state; computed desktop columns are one column and the heading has a normal readable width.
- Active question render still includes the sidebar/two-column shell.
- Recovery dialog has `role=dialog`, `aria-modal`, labelled heading/description, exact-choice buttons, and `Continue without recovery`; focus is contained and Escape returns to the triggering surface.
- Reconciliation shows both revisions and `Keep server`; selecting it replaces the local draft without a stale revision remaining.
- Delivery cannot close before acknowledgement; uncertain delivery exposes retry and preserves the result; denied close exposes actionable safe-close copy.
- At 390x844, settings and recovery panels scroll vertically without horizontal clipping; keyboard-only scale ArrowUp then Enter advances; Cancel restores the saved theme.

Existing focused command: `node --test test/views-a11y.test.js test/views-a11y-recovery.test.js test/browser-recovery-e2e.test.js test/live.test.js test/browser-settings-e2e.test.js`. [VERIFIED: local run: 21 passed, 1 expected Playwright-package skip]

## Common Pitfalls

### Empty grid column on waiting state
**What goes wrong:** Idle content is placed in the inspector grid track while no sidebar exists, producing excessive wrapping at desktop widths. [VERIFIED: live observation and source read]
**How to avoid:** Assert the waiting shell’s single-column class/computed layout at desktop width and preserve active-round two-column behavior.

### Treating source-contract tests as visual evidence
**What goes wrong:** Regex tests prove markup intent but cannot prove computed layout, contrast, focus rings, screen-reader announcements, or browser close policy. [VERIFIED: archived Phase 11 UAT]
**How to avoid:** Store screenshots or an explicit unavailable-evidence record for each required lane.

### Confusing acknowledgement with answer POST
**What goes wrong:** Closing after answer submission can lose delivery confirmation. [VERIFIED: Phase 11 UAT and `web/app.js`]
**How to avoid:** Browser evidence records request order and verifies ack success before `attemptClose`; inject ack failure and denied-close cases separately.

### Overclaiming assistive-technology coverage
**What goes wrong:** `aria-*` presence is reported as screen-reader verification. [VERIFIED: archived UAT gap]
**How to avoid:** Mark screen-reader output, private storage/quota, opener/profile failure, origin drift, and browser ownership denial as external/manual until run in an appropriate environment.

## Evidence Matrix

| Lane | Local status | Required artifact |
|------|--------------|-------------------|
| Settings desktop/mobile, theme cancel, internal scroll | Live behavior observed; screenshots not yet retained | Desktop and 390x844 screenshots plus keyboard/focus notes, or unavailable record. [VERIFIED: user observation; Phase 10 UI review] |
| Waiting desktop layout | Defect reproduced at 1512px | Before/after screenshot and computed grid measurement; regression test. [VERIFIED: user observation] |
| Exact recovery chooser | Live exact chooser path observed; automated contract passes | Screenshot showing redacted exact choices and Continue without recovery, plus request selector evidence. [VERIFIED: user observation; tests] |
| Draft reconciliation | Live Keep server observed; automated contract passes | Screenshot/dialog focus notes and server-vs-local revision result. [VERIFIED: user observation; tests] |
| Delivery ack/close fallback | Delivery and recovery observed; close denial not forced | Ack-before-close trace and denied-close screenshot, or explicit unavailable record. [VERIFIED: user observation; Phase 11 UAT] |
| Screen reader/private mode/origin/opener | Unavailable in this workspace | Explicit external-gap record; do not mark pass. [VERIFIED: Phase 11 UAT] |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Focused tests/bridge | ✓ | v26.0.0 | Project supports >=18. [VERIFIED: local command/stack] |
| npm | Browser/test scripts | ✓ | 11.12.1 | — [VERIFIED: local environment recorded in project artifacts] |
| Browser CLI harness | Settings smoke | ✓ | Existing script | `npm run test:browser`; artifacts may be removed by harness. [VERIFIED: Phase 11 UAT] |
| Playwright Node package | Executable browser screenshots | ✗ | — | Use dedicated evidence environment; current test skips. [VERIFIED: local focused command] |
| Screen reader/AT | UI-01/UI-02 external lane | ✗ | — | Human browser/AT handoff; no honest local substitute. [VERIFIED: Phase 11 UAT] |
| Native Linux/Windows | Cross-platform browser claim | ✗ | — | Record as external gap; do not promote support claims. [VERIFIED: `STATE.md`] |

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Native `node:test` |
| Config file | None |
| Quick run command | `node --test test/views-a11y.test.js test/views-a11y-recovery.test.js test/browser-recovery-e2e.test.js test/live.test.js test/browser-settings-e2e.test.js` |
| Browser smoke command | `npm run test:browser` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | Waiting/settings/recovery/delivery layout and semantics remain reviewable | focused source + browser/manual | focused command above; `npm run test:browser` | Partial; add waiting-layout regression |
| UI-02 | Exact recovery, reconciliation, ack ordering, fallback, keyboard ownership | unit/source + browser/manual | focused command above; preserve browser artifacts | Partial; existing contracts need live evidence extension |

### Wave 0 Gaps

- [ ] Add waiting-shell single-column regression.
- [ ] Add browser evidence capture/manifest with viewport, theme, state, timestamp, and unavailable reason fields.
- [ ] Add manual browser matrix for denied `window.close()`, uncertain acknowledgement, private-mode quota, origin/port drift, opener/profile failure, reduced motion, and screen-reader announcements.
- [ ] Preserve screenshots rather than deleting temporary browser artifacts when closing UI-01/UI-02.

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | No new auth surface | Keep bridge loopback-only and single-user. [VERIFIED: project constraints] |
| V3 Session Management | Yes | Use opaque exact round selectors, durable acknowledgement, and no implicit newest-round recovery. [VERIFIED: Phase 11 UAT] |
| V4 Access Control | Yes | Do not expose remote bridge; recovery actions must operate only on server-provided round capabilities. [VERIFIED: project constraints/codebase] |
| V5 Input Validation | Yes | Preserve server boundary validation and redacted recovery metadata; browser tests must not inject answer payloads into evidence. [VERIFIED: codebase/tests] |
| V6 Cryptography | No new crypto | Do not introduce credentials or remote auth as part of visual QA. [VERIFIED: scope] |

## Explicit External Gaps

The following cannot be honestly closed from this macOS workspace: real screenshots if the Playwright Node package remains unavailable; screen-reader announcements; browser ownership denial for `window.close()`; private browsing/storage quota failure; localhost origin/port drift; preferred browser/profile opener failure; and native Linux/Windows behavior. [VERIFIED: Phase 11 UAT/VERIFICATION, local environment] These must appear as dated unavailable-evidence records, not as passing claims.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | An explicit `.app--waiting` class is the least invasive implementation of the observed empty-grid defect. | Architecture Patterns | Planner may choose a different equivalent selector; active-round layout must remain unchanged. |
| A2 | The existing browser CLI can be extended or wrapped to retain screenshots in a stable artifact directory. | Evidence Matrix | Harness may require a separate Playwright installation or manual browser capture. |

## Sources

### Primary (HIGH confidence)

- Local source: `web/app.js`, `web/views.js`, `web/live.js`, `web/settings-panel.js`, `web/styles.css`. [VERIFIED: codebase read]
- Local tests: `test/views-a11y.test.js`, `test/views-a11y-recovery.test.js`, `test/browser-recovery-e2e.test.js`, `test/live.test.js`, `test/browser-settings-e2e.test.js`. [VERIFIED: codebase read and focused run]
- `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/milestones/v1.1-UAT-SUMMARY.md`. [VERIFIED: codebase read]
- Archived Phase 10 UI review/UAT and Phase 11 UI spec/UAT/verification. [VERIFIED: codebase read]

### Secondary (MEDIUM confidence)

- Live browser observations supplied in the phase request, dated 2026-07-18. [VERIFIED: operator observation]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing repository stack and scripts are direct evidence.
- Architecture: HIGH — component/state/CSS ownership is visible in source and prior verification.
- Visual/accessibility completeness: MEDIUM — implementation seams are clear, but screenshots and AT evidence remain unavailable.

**Research date:** 2026-07-18
**Valid until:** 2026-08-17 for stable repository guidance; browser/tool availability must be rechecked at execution time.
