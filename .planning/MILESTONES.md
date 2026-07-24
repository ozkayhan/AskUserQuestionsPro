# Milestones

## v1.2.0 Bug Fixes (Shipped: 2026-07-24)

**Phases completed:** 1 phases, 3 plans, 7 tasks

**Key accomplishments:**

- Redacted exact-round recovery discovery and deletion over the loopback bridge, with complete runtime cleanup and after-delivery closure defaults
- 1. [Rule 1 - Bug] Preserved React hook ordering in retired Flow state

---

## v1.1.1 Release Hardening (Prepared: 2026-07-18)

**Closeout:** Override closeout; local release gates pass, while package publication/tag and external validation remain explicit handoffs.

**Phases completed:** 6 phases, 15 plans planned.

**Delivered:** Clean lint/format policy, reproducible installs, current browser/UAT evidence, security/privacy checks, documentation/release handoff, package gates, and isolated macOS installer lifecycle evidence.

**Release path:** `.changeset/steady-v11-hardening.md` is prepared. After the release PR merges, GitHub Actions creates the Version Packages PR; merging it bumps 1.1.1, publishes to npm with `NPM_TOKEN`, and creates the release tag.

**Known gaps:** Authenticated Claude/Codex, native Windows/Linux, and exhaustive browser/AT lanes require external environments.

---

## v1.1 Reliability, Extensibility, and Productization (Shipped: 2026-07-17)

**Phases completed:** 6 phases, 26 plans, 3 tasks

**Delivered:** Durable long-round recovery, settings v2, accessible browser delivery, adapter contracts, and evidence-gated host/release hardening.

**Key accomplishments:**

- Made lifecycle ownership, detach/resume, durable drafts, immutable results, and delivery acknowledgement explicit and redacted.
- Shipped settings v2 with schema validation, migration backups, CAS import/export/reset, doctor projection, and browser evidence.
- Wired browser recovery/delivery UX, including exact-round selection, reconciliation, retryable acknowledgement, and safe closure fallback.
- Defined Claude/Codex adapter contracts with fake-host conformance, scoped install lifecycle, and Tier 1 acceptance gates.
- Added dated host capability cards, native-OS evidence handoff, release/package gates, and fail-closed promotion for unsupported hosts.

---

## v1.0.0 Roadmap Archive (Backfilled: 2026-07-17)

**Note:** Synthesized from archive snapshot by `/gsd-health --backfill`. Original completion date unknown.

---
