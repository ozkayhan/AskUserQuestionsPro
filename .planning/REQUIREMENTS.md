# Requirements: AskUserQuestionsPro Reliability, Extensibility, and Productization

**Defined:** 2026-07-17
**Milestone:** v1.1 Sprint 2
**Core Value:** Users must be able to complete and safely deliver a long, multi-question round without losing answers, regardless of which supported AI coding host initiated it.

## v1 Requirements

Requirements for Sprint 2. Each maps to exactly one roadmap phase.

### Lifecycle and Timeout

- [ ] **LIFE-01**: Round lifecycle states are explicit: drafting, detached, reconnecting, delivery-pending, delivered, delivery-uncertain, cancelled, recovery-error, and expired.
- [ ] **LIFE-02**: Lifecycle events identify the responsible boundary without logging question or answer content.
- [ ] **LIFE-03**: Stale, duplicate, delayed, or unauthorized lifecycle operations cannot affect another round.
- [ ] **LIFE-04**: The app introduces no avoidable idle timeout; unavoidable host deadlines detach the round while preserving recovery.
- [ ] **LIFE-05**: Lifecycle races and deadline behavior have deterministic automated coverage.

### Durable Round Storage

- [ ] **DUR-01**: The server maintains the authoritative versioned round record on local disk.
- [ ] **DUR-02**: Meaningful answer edits are incrementally persisted with revisions.
- [ ] **DUR-03**: Round records survive bridge restart, crash recovery, partial writes, and corruption through atomic snapshots and quarantine.
- [ ] **DUR-04**: Users can view and select an exact recoverable round without arbitrary “latest round” behavior.
- [ ] **DUR-05**: Final answers are immutable and result retrieval/delivery acknowledgement is idempotent.
- [ ] **DUR-06**: Existing pre-v1.1 requests can migrate safely to the durable round model.

### Settings v2

- [ ] **SET-01**: Browser and Node share one versioned settings schema and validation contract.
- [ ] **SET-02**: Settings migrations are idempotent, backed up, and safely reject unsupported future versions.
- [ ] **SET-03**: Users can configure browser launch, retention, autosave, recovery, lifecycle diagnostics, delivery behavior, post-submit closure, and adapter preferences.
- [ ] **SET-04**: Settings import provides preview, validation errors, partial-import prevention, and safe rollback.
- [ ] **SET-05**: Users can export settings, reset individual namespaces, and inspect effective non-sensitive settings through doctor output.
- [ ] **SET-06**: Settings UI preserves accessibility, keyboard behavior, and persisted values across reloads and upgrades.

### Browser Recovery and Delivery UX

- [ ] **WEB-05**: Browser-side drafts reconcile with the server-authoritative record after refresh, reconnect, or origin/session changes.
- [ ] **WEB-06**: The UI clearly distinguishes saved, delivery-pending, delivered, delivery-uncertain, cancelled, and recovery-error states.
- [ ] **WEB-07**: A tab closes only after durable delivery acknowledgement, and falls back safely when browser ownership prevents automatic closure.
- [ ] **WEB-08**: Users can select the browser/opening strategy and receive actionable fallback guidance.
- [ ] **WEB-09**: Recovery, settings, status announcements, focus management, and keyboard flows remain accessible.

### Adapter Workflow

- [ ] **ADP-01**: A documented adapter contract defines start, attach, detach, cancel, resume, status, result, and delivery acknowledgement behavior.
- [ ] **ADP-02**: Each host has a capability descriptor covering transport, timeout, cancellation, approval, trust, configuration scope, installation, and evidence status.
- [ ] **ADP-03**: A fake-host conformance harness verifies adapter lifecycle and idempotency behavior.
- [ ] **ADP-04**: Claude Code and Codex remain separate adapters with their host-specific framing, fallback, timeout, and cancellation semantics preserved.
- [ ] **ADP-05**: Adapter installation, doctor, upgrade, and uninstall operations are scoped, idempotent, and safe.
- [ ] **ADP-06**: New-host onboarding requires official documentation review, local installation/testing, automated conformance, manual long-round verification, and release evidence.

### Host Support

- [ ] **HST-01**: Version-pinned authenticated Claude Code and Codex acceptance runs verify idle rounds, reconnect, restart, cancellation, recovery, and delivery.
- [ ] **HST-02**: Cursor, GitHub Copilot CLI, Gemini CLI, and Amazon Q Developer are evaluated as the first expansion cohort and receive only evidence-backed statuses.
- [ ] **HST-03**: Cline, Kiro, Kilo Code, Qwen Code, and OpenCode are evaluated through the same adapter gate.
- [ ] **HST-04**: Roo Code and Windsurf are researched individually; Aider remains explicitly unsupported unless a safe authoritative integration surface is verified.
- [ ] **HST-05**: A machine-readable and user-facing compatibility matrix shows host version, transport, tested scenarios, limitations, and evidence date.
- [ ] **HST-06**: Hosts that cannot safely integrate receive a clear unsupported explanation rather than an unverified compatibility claim.

### Quality and Documentation

- [ ] **QLT-01**: Durable storage and recovery are verified on supported macOS, Linux, and Windows environments.
- [ ] **QLT-02**: Clean-checkout tests, lint, formatting, shell checks, packaging, and release checks pass together.
- [ ] **QLT-03**: Fresh install, upgrade, uninstall, trust-policy, and configuration-scope behavior are covered for every claimed supported host.
- [ ] **DOC-06**: Maintained documentation explains settings, recovery, timeout ownership, delivery acknowledgement, and troubleshooting.
- [ ] **DOC-07**: Every supported or unsupported host has a capability card with evidence and limitations.
- [ ] **DOC-08**: Support diagnostics and recovery artifacts avoid question/answer leakage and document local retention/privacy behavior.

## v2 Requirements

Deferred beyond this milestone but retained for future planning.

### Product Expansion

- **FUT-01**: Remote multi-user service, authentication, cloud persistence, or database-backed synchronization.
- **FUT-02**: New unrelated question types beyond the existing compatibility contract.
- **FUT-03**: Host-specific marketplace extensions or native binaries without a proven safety and maintenance case.
- **FUT-04**: Replacement of the zero-build/vendored-asset distribution model without evidence that it is necessary.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Unverified “support” for every AI coding host | Compatibility is a public claim and requires official documentation plus installed-host evidence; unsupported status is safer than a misleading integration. |
| Remote or multi-user operation | The local single-user localhost safety model remains a hard product constraint for this milestone. |
| Browser storage as the sole source of truth | Browser storage is best-effort and cannot protect work from profile, quota, origin, or process failures. |
| Arbitrary host command execution through imported settings | Settings must not weaken the loopback-only security boundary or create a hidden code execution path. |

## Traceability

Populated during roadmap creation. Every v1 requirement must map to exactly one phase.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LIFE-01 through LIFE-05 | Pending | Pending |
| DUR-01 through DUR-06 | Pending | Pending |
| SET-01 through SET-06 | Pending | Pending |
| WEB-05 through WEB-09 | Pending | Pending |
| ADP-01 through ADP-06 | Pending | Pending |
| HST-01 through HST-06 | Pending | Pending |
| QLT-01 through QLT-03 | Pending | Pending |
| DOC-06 through DOC-08 | Pending | Pending |

**Coverage:**

- v1 requirements: 41 total
- Mapped to phases: 0
- Unmapped: 41 — roadmap creation pending

---
*Requirements defined: 2026-07-17*
*Last updated: 2026-07-17 after v1.1 Sprint 2 scope approval*
