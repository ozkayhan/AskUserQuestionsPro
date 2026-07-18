# Roadmap: AskUserQuestionsPro v1.1.1 Release Hardening

## Milestone

**Current milestone:** v1.1.1 Release Hardening
**Goal:** Turn the shipped v1.1 implementation into a clean, reproducible, quality-gated, honestly documented release.
**Core value:** Users can complete and safely deliver long question rounds without losing answers, while maintainers can reproduce and verify the release from a clean checkout.

## Completed Milestones

- [x] **v1.0.0 — AskUserQuestionsPro Reliability and Documentation Overhaul** (2026-07-16) — Phases 1–7 complete. [Archived roadmap](milestones/v1.0.0-ROADMAP.md) · [Archived requirements](milestones/v1.0.0-REQUIREMENTS.md)
- [x] **v1.1 — Reliability, Extensibility, and Productization** (2026-07-17) — Phases 8–13 complete; implementation and local integration shipped with explicit external evidence limitations. [Archived roadmap](milestones/v1.1-ROADMAP.md) · [Audit](milestones/v1.1-MILESTONE-AUDIT.md) · [UAT summary](milestones/v1.1-UAT-SUMMARY.md)

## v1.1 Shipped History

Phases 8–13 delivered the lifecycle contract, durable round store and recovery API, settings v2, browser recovery/delivery UX, Claude/Codex adapter contracts, and evidence-gated host/release hardening. The v1.1 audit found no critical integration blockers and recorded 500 passing tests, one expected Playwright skip, package/audit/shell/release checks passing, and no diagnosed application defect. Its `partial`/`tech_debt` status reflects unavailable evidence—not completed claims—for native Linux/Windows runs, authenticated Claude/Codex runs, exhaustive browser/AT scenarios, and local ESLint/Prettier execution.

## Phases

- [x] **Phase 14: Static Quality & Reproducibility** - Close lint/format gaps and prove a clean `npm ci` reproduces the declared quality gates without production dependency changes.
- [ ] **Phase 15: Browser Visual & Accessibility QA** - Reconcile current browser behavior with visual, keyboard, focus, and accessibility evidence for settings, recovery, and delivery.
- [ ] **Phase 16: Cross-Phase UAT & Full Verification** - Reconcile archived phase evidence and rerun the complete release-critical verification surface without diagnosing an untracked application issue.
- [ ] **Phase 17: Security & Privacy Audit** - Recheck local-only boundaries, capability ownership, redaction, settings/package safety, and fail-closed promotion behavior.
- [ ] **Phase 18: Documentation & Release Evidence Sync** - Make maintained docs and v1.1.1 evidence artifacts accurately reproduce the final status and external handoffs.
- [ ] **Phase 19: Final Release Readiness & Ship Gates** - Assemble the final clean-checkout release proof and stop shipment unless every locally testable gate passes and every external gap is explicitly handed off.

## Phase Details

### Phase 14: Static Quality & Reproducibility

**Goal**: Maintainers can install the declared development toolchain from a clean checkout and run lint, formatting, tests, packaging, and audit entry points reproducibly without broad unreviewed churn or production dependency changes.
**Depends on**: Phase 13
**Requirements**: QUAL-01, QUAL-02, QUAL-03
**Success Criteria** (what must be TRUE):

  1. `npm run lint` completes with zero errors using the repository-declared toolchain.
  2. `npm run format:check` completes with zero differences under an explicit, reviewable scope that includes application source and does not silently exclude it.
  3. A clean `npm ci` on the supported Node baseline exposes working test, lint, format, package, and audit commands.
  4. The hardening changes preserve zero production dependencies and avoid unrelated formatting churn.

**Plans**: 2/2 plans executed

Plans:

- [x] 14-01-PLAN.md — Resolve the exact ESLint findings without weakening rules
- [x] 14-02-PLAN.md — Define maintained Prettier scope and prove clean-install reproducibility

### Phase 15: Browser Visual & Accessibility QA

**Goal**: Users can navigate and understand the settings, recovery, reconciliation, and delivery flows in the current browser experience, with visual and accessibility evidence or a precise unavailable-evidence record for each remaining lane.
**Depends on**: Phase 14
**Requirements**: UI-01, UI-02
**Success Criteria** (what must be TRUE):

  1. Current screenshots or an explicit evidence record cover settings, exact recovery selection, draft reconciliation, delivery acknowledgement, and fallback states.
  2. Browser smoke demonstrates that exact-round recovery, server-authoritative draft reconciliation, acknowledgement-before-close, and actionable opener/delivery fallback work as user-visible flows.
  3. Keyboard navigation, focus ownership, dialog semantics, and live announcements are verified in the available browser path, with screen-reader and other unavailable AT evidence clearly marked external.
  4. Browser-origin drift, private-mode/quota, opener failure, and ownership-denied `window.close()` are either evidenced in an available environment or recorded as external handoff items rather than implied as passed.

**Plans**: 2/2 plans executed

Plans:

- [x] 15-01-PLAN.md — Fix the waiting-shell empty grid column and add focused UI regression coverage
- [x] 15-02-PLAN.md — Run browser visual/accessibility QA and retain evidence or explicit external gaps

**UI hint**: yes

### Phase 16: Cross-Phase UAT & Full Verification

**Goal**: Maintainers have one reconciled view of v1.1 behavior and current verification results, with all release-critical local suites passing and no diagnosed application issue hidden by stale phase artifacts.
**Depends on**: Phase 15
**Requirements**: UAT-01, UAT-02
**Success Criteria** (what must be TRUE):

  1. Archived UAT reports for Phases 8–13 agree with current command results, verification reports, and the v1.1 integration check.
  2. The full workspace suite passes with the expected Playwright skip only, and each release-critical focused suite passes after hardening changes.
  3. The end-to-end paths from host ask through durable registration, browser recovery, answer delivery, acknowledgement, and adapter response are verified or linked to explicit evidence.
  4. Missing authenticated Claude/Codex and native Windows/Linux evidence is separated from local test results and remains an external handoff, not a completion claim.

**Plans**: 3 plans

Plans:

- [ ] 16-00-PLAN.md — Create deterministic verification runner and final validator artifacts
- [ ] 16-01-PLAN.md — Reconcile archived Phase 8–13 UAT evidence into the current matrix
- [ ] 16-02-PLAN.md — Run full release-critical verification and publish the current UAT summary

### Phase 17: Security & Privacy Audit

**Goal**: The final checkout remains safely local, capability-scoped, privacy-preserving, and fail-closed when inputs, package contents, installer targets, or host evidence are malformed or unavailable.
**Depends on**: Phase 16
**Requirements**: SEC-01, SEC-02
**Success Criteria** (what must be TRUE):

  1. Loopback binding, request/round capability ownership, stale-operation guards, and lifecycle/settings/evidence redaction checks pass.
  2. Malformed and future settings imports leave current configuration safe, and installer/upgrade/uninstall scope does not escape intended host configuration.
  3. The published package contains only the intended boundary, retains zero production dependencies, and does not expose question/answer payloads through diagnostics or evidence artifacts.
  4. Unsupported or unavailable host evidence cannot promote a capability to Supported, and the external Windows/authenticated Claude/Codex handoff remains fail-closed.

**Plans**: TBD

### Phase 18: Documentation & Release Evidence Sync

**Goal**: A future maintainer can reproduce the release decision from concise, current documentation that preserves historical rationale and distinguishes local proof from external handoff.
**Depends on**: Phase 17
**Requirements**: DOC-01, DOC-02
**Success Criteria** (what must be TRUE):

  1. Maintained settings, recovery, lifecycle/timeout, delivery, troubleshooting, privacy, compatibility, lint/format, and release docs describe the final behavior without stale contradictions.
  2. The v1.1.1 UAT, security, audit, and release evidence artifacts identify commands, results, dates, expected skips, known limitations, and reproducible handoff steps.
  3. Historical v1.0.0/v1.1 rationale and archived evidence remain discoverable; cleanup removes duplication only where the source of truth is preserved.
  4. Windows and authenticated Claude/Codex work are explicitly labeled external handoff and are not presented as completed evidence.

**Plans**: TBD

### Phase 19: Final Release Readiness & Ship Gates

**Goal**: The v1.1.1 release is shippable from a clean checkout only when all locally testable quality, package, installer, security, documentation, and release gates pass together and all unavailable evidence is honestly bounded.
**Depends on**: Phase 18
**Requirements**: REL-01, REL-02, REL-03
**Success Criteria** (what must be TRUE):

  1. Package dry-run, production dependency audit, shell checks, installer lifecycle checks, and release workflow gates pass together from the final checkout.
  2. The release checklist records clean install, upgrade, uninstall, configuration-scope, and no-destructive-fallback results for every locally testable target.
  3. The final release evidence links the passing full suite, focused suites, browser QA, security audit, documentation sync, and package boundary checks.
  4. Native Windows and authenticated Claude/Codex validation are recorded as external handoff items with owners/environment instructions and are never counted as completed local evidence.
  5. The ship decision is explicitly Ready or Blocked based on the documented gates; no unsupported host or platform claim is promoted by omission.

**Plans**: TBD

## Progress

**Execution Order:** Phases execute in numeric order: 14 → 15 → 16 → 17 → 18 → 19

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 14. Static Quality & Reproducibility | 2/2 | Complete | 2026-07-18 |
| 15. Browser Visual & Accessibility QA | 2/2 | In Progress|  |
| 16. Cross-Phase UAT & Full Verification | 0/TBD | Not started | - |
| 17. Security & Privacy Audit | 0/TBD | Not started | - |
| 18. Documentation & Release Evidence Sync | 0/TBD | Not started | - |
| 19. Final Release Readiness & Ship Gates | 0/TBD | Not started | - |

## Requirement Coverage

| Requirement | Phase | Status |
|-------------|-------|--------|
| QUAL-01 | Phase 14 | Complete |
| QUAL-02 | Phase 14 | Complete |
| QUAL-03 | Phase 14 | Complete |
| UI-01 | Phase 15 | Pending |
| UI-02 | Phase 15 | Pending |
| UAT-01 | Phase 16 | Pending |
| UAT-02 | Phase 16 | Pending |
| SEC-01 | Phase 17 | Pending |
| SEC-02 | Phase 17 | Pending |
| DOC-01 | Phase 18 | Pending |
| DOC-02 | Phase 18 | Pending |
| REL-01 | Phase 19 | Pending |
| REL-02 | Phase 19 | Pending |
| REL-03 | Phase 19 | Pending |

**Coverage:** 14/14 v1.1.1 requirements mapped exactly once; no orphaned requirements.

---
*Roadmap created: 2026-07-18*
