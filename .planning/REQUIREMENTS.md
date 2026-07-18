# Requirements: AskUserQuestionsPro v1.1.1 Release Hardening

**Defined:** 2026-07-18
**Milestone:** v1.1.1 Release Hardening
**Core Value:** A shipped reliability product should be reproducible, quality-gated, honestly documented, and safe to release even when external host/OS evidence is unavailable.

## v1 Requirements

### Static Quality and Reproducibility

- [x] **QUAL-01**: `npm run lint` completes with zero errors using the declared development toolchain.
- [x] **QUAL-02**: `npm run format:check` completes with zero differences under an explicit, reviewable scope that does not hide application source.
- [x] **QUAL-03**: A clean `npm ci` install on the supported Node baseline reproduces the test, lint, format, package, and audit command entry points without adding production dependencies.

### Browser and UAT Confidence

- [ ] **UI-01**: Settings, recovery, and delivery screens receive a current browser visual/accessibility review with screenshots or an explicit unavailable-evidence record.
- [ ] **UI-02**: Browser smoke verifies exact recovery selection, draft reconciliation, delivery acknowledgement-before-close, keyboard/focus ownership, and actionable fallback behavior.
- [ ] **UAT-01**: Archived phases 8–13 have reconciled UAT records with current command results, zero diagnosed application issues, and explicit external limitations.
- [ ] **UAT-02**: The full workspace suite and each release-critical focused suite pass after hardening changes.

### Security and Privacy

- [ ] **SEC-01**: Loopback binding, capability ownership, lifecycle redaction, settings redaction, and evidence-corpus privacy checks pass in the final checkout.
- [ ] **SEC-02**: Settings import, installer scope, package boundary, and host capability promotion remain fail-closed under malformed, unsupported, or unavailable evidence.

### Documentation and Release

- [ ] **DOC-01**: Maintained docs accurately describe lint/format policy, UAT status, release gates, and known Windows/Claude evidence gaps.
- [ ] **DOC-02**: The v1.1.1 audit and UAT artifacts provide a concise reproducible handoff for a future maintainer.
- [ ] **REL-01**: Package dry-run, production dependency audit, shell checks, installer lifecycle checks, and release workflow gates pass together.
- [ ] **REL-02**: The release checklist verifies clean-install, upgrade, uninstall, configuration-scope, and no-destructive-fallback behavior where locally testable.
- [ ] **REL-03**: Unavailable native Windows and authenticated Claude/Codex validation are recorded as external handoff items and never promoted as completed evidence.

## v2 Requirements

### External Validation

- **EXT-01**: Run authenticated Claude Code acceptance across supported versions and host deadline configurations.
- **EXT-02**: Run native Windows durability, installer, and browser evidence on a supported Windows environment.
- **EXT-03**: Run exhaustive assistive-technology, private-mode, origin-drift, opener-failure, and denied-close browser validation.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Installing Windows or Claude Code in this Mac workspace | External environments are unavailable and must be handed off honestly. |
| Broad product feature expansion | This milestone hardens and releases v1.1; new product capabilities need a separate milestone. |
| Blindly formatting archived historical artifacts | Historical planning evidence must remain readable and changes must be reviewable. |
| Claiming unsupported host compatibility from protocol similarity | Host support remains evidence-gated. |

## Traceability

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

**Coverage:**

- v1 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0

---
*Requirements defined: 2026-07-18*
*Last updated: 2026-07-18 after v1.1.1 milestone start*
