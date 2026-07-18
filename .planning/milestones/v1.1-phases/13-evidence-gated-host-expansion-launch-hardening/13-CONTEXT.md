# Phase 13: Evidence-Gated Host Expansion & Launch Hardening — Context

**Gathered:** 2026-07-17  
**Status:** Ready for autonomous execution

## Decisions

### D-01 — Evidence is the compatibility contract

Use one machine-readable, schema-validated evidence ledger as the source for the user-facing matrix and individual capability cards. Every named host and Aider must have a dated row; rows carry evidence class, exact version when available, transport/config scope, scenarios, limitations, and redacted results. Preserve `Supported`, `Experimental`, `Researching`, and `Unsupported` semantics exactly; no host may be promoted from protocol discoverability alone.

### D-02 — Missing installed hosts remain honest

Refresh official documentation and record candidate gates, but do not install external hosts in this workspace. An absent executable or missing authenticated run is `Researching`/`Unavailable`, not a passing result. Aider remains explicitly `Unsupported` unless a safe authoritative integration surface and complete host evidence are later proven.

### D-03 — Evidence must be privacy-safe and reproducible

Evidence may contain opaque IDs, lifecycle metadata, versions, commands, dates, redacted errors, and environment/config-root descriptors. It must not contain question text, answer text, credentials, tokens, or sensitive absolute paths. Automated integrity tests must reject leakage, malformed statuses, unsupported promotion, stale/missing dates, and JSON/Markdown drift.

### D-04 — Cross-platform claims require platform evidence

Durability, restart/corruption/quarantine, permissions, retention, installer scope, trust policy, browser fallback, and loopback behavior are recorded separately for macOS, Linux, and native Windows. WSL or a macOS-only run cannot close a Windows/Linux claim.

### D-05 — Preserve the distribution contract

Keep Node.js 18+, zero production dependencies, loopback-only binding, vendored browser assets, existing installer ownership, and current release workflow. Phase 13 may add evidence tooling, tests, docs, fixtures, and release gates, but must not broaden `ASKUSER_TARGET` or create generic unverified host adapters.

## Deferred / Out of Scope

- Installing or authenticating missing candidate hosts in this workspace.
- Promoting any candidate without official documentation, installed-host conformance, manual long-round evidence, and scoped install evidence.
- Remote/multi-user operation, arbitrary imported command execution, or new production dependencies.
