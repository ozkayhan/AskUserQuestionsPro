---
phase: 10
slug: settings-v2
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-17
---

# Phase 10 — Security

> Settings v2 threat mitigations verified against the plan-time register and completed implementation.

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Settings file → runtime | Untrusted or future-version disk data becomes executable configuration. | JSON settings |
| Import HTTP/CLI → persistence | User-provided JSON crosses into local durable state. | Import payloads |
| Browser UI → localhost API | Browser controls submit settings and receive effective projections. | Local settings and status |
| Doctor/export → terminal/filesystem | Effective settings and diagnostics cross into operator-visible output. | Redacted settings |

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-10-SC | Tampering | npm/pip/cargo installs | high | accept | No package installation; zero runtime dependencies preserved. | closed |
| T-10-01 | Tampering | `lib/settings.js` migration | high | mitigate | Private exclusive backup, fsync, collision reuse, atomic replacement, and failure-preservation tests. | closed |
| T-10-02 | Tampering/DoS | `server.js` import apply | high | mitigate | Bounds, schema validation, payload/baseline CAS, lock-held re-read, atomic writes, and rollback tests. | closed |
| T-10-03 | Information disclosure | `bin/cli.js` doctor/export | high | mitigate | Allowlisted projection, path redaction/truncation, deterministic output, no-store headers, and CLI regression tests. | closed |
| T-10-04 | Elevation of privilege | Runtime settings consumers | critical | mitigate | Only schema-owned behavior settings are consumed; executable commands, host installation, and loopback binding remain outside the importable contract. | closed |
| T-10-05 | Availability/data loss | Browser save/closure | high | mitigate | Durable acknowledgement before closure, baseline-preserving rollback, modal busy-state guards, and browser assertions. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-10-SC | T-10-SC | No package installation is planned; the zero-runtime-dependency constraint is retained. | Project constraints | 2026-07-17 |

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-17 | 6 | 6 | 0 | GSD phase verification |

## Sign-Off

- [x] All threats have a disposition
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-17
