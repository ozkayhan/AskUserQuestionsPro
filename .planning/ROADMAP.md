# Roadmap: AskUserQuestionsPro

## Current milestone

**v1.2.0 Bug Fixes** — eliminate duplicate completed tabs and make local-server recovery prompts state-driven and understandable.

### Phase 19: Browser Lifecycle and Recovery Corrections `[x]`

**Goal:** A successfully delivered round ends its owning tab cleanly, and recovery UI appears only for a real recoverable interruption.

**Requirements:** TAB-01, TAB-02, REC-01, REC-02

**Status:** Complete — 2026-07-19

**Success criteria:**

1. A successfully acknowledged round closes its owning browser tab and cannot render a later round.
2. Opening a subsequent round produces one active tab without a duplicate in the completed tab.
3. Normal successful delivery does not show a local-server recovery prompt.
4. Interrupted or detached rounds show a clear, valid recovery action and preserve the existing recoverable flow.

## Completed Milestones

- [x] **v1.0.0 — AskUserQuestionsPro Reliability and Documentation Overhaul** (2026-07-16) — Phases 1–7 complete. [Archived roadmap](milestones/v1.0.0-ROADMAP.md) · [Archived requirements](milestones/v1.0.0-REQUIREMENTS.md)
- [x] **v1.1 — Reliability, Extensibility, and Productization** (2026-07-17) — Phases 8–13 complete; implementation and local integration shipped with explicit external evidence limitations. [Archived roadmap](milestones/v1.1-ROADMAP.md) · [Audit](milestones/v1.1-MILESTONE-AUDIT.md) · [UAT summary](milestones/v1.1-UAT-SUMMARY.md)
- [x] **v1.1.1 — Release Hardening** (2026-07-18) — Quality, browser/UAT, security, documentation, packaging, installer, and release gates assembled; npm publication and tag delegated to Changesets after merge. [Archived roadmap](milestones/v1.1.1-ROADMAP.md) · [Archived requirements](milestones/v1.1.1-REQUIREMENTS.md) · [Audit](v1.1.1-MILESTONE-AUDIT.md)

## Historical detail

Full v1.0.0, v1.1, and v1.1.1 phase detail is preserved in `.planning/milestones/`.

## Next steps

- Merge the release-preparation PR.
- Merge the generated Version Packages PR created by the Changesets action.
- Start the next milestone with `$gsd-new-milestone` after v1.1.1 is published.
