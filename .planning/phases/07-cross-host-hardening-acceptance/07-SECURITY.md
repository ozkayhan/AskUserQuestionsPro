---
phase: 07
slug: cross-host-hardening-acceptance
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-16
---

# Phase 07 — Security

> Retroactive security contract for the long-running host round, detach/resume,
> and cross-host acceptance changes.

## Trust Boundaries

| Boundary                    | Description                                                                      | Data Crossing                                                    |
| --------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Host ↔ local bridge         | Claude Code or Codex communicates with the loopback HTTP bridge and MCP process. | Request IDs, question metadata, answer payloads, lifecycle state |
| Browser ↔ local bridge      | The local browser UI posts answers to the bridge.                                | Question IDs and user-entered answers                            |
| CLI installer ↔ host config | The installer writes Claude and Codex integration files and timeout settings.    | Local paths and configuration values                             |

## Threat Register

| Threat ID | Category                   | Component                | Severity | Disposition | Mitigation                                                                                                                                             | Status |
| --------- | -------------------------- | ------------------------ | -------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| T-07-01   | Spoofing                   | Loopback bridge          | medium   | accept      | Bridge binds to `127.0.0.1`; single-user local process boundary is an intentional architecture decision (D-001).                                       | closed |
| T-07-02   | Tampering                  | Answer routing           | high     | mitigate    | Request IDs, expected round ownership, answer validation, and regression tests prevent stale or cross-round answer injection.                          | closed |
| T-07-03   | Denial of service          | Detached rounds          | high     | mitigate    | Detached rounds have a one-hour TTL, single-flight ownership, unref’d timers, bounded completed-answer retention, and waiter cleanup.                  | closed |
| T-07-04   | Repudiation / availability | Host disconnect recovery | high     | mitigate    | A request-ID-bearing disconnect detaches rather than cancels the browser round; `/resume` reattaches it, while explicit cancellation remains terminal. | closed |
| T-07-05   | Information disclosure     | Lifecycle logging        | medium   | mitigate    | Lifecycle diagnostics use identifiers and timing only; question and answer contents are not logged or persisted by the bridge.                         | closed |
| T-07-06   | Tampering                  | HTTP and MCP input       | medium   | mitigate    | Typed request validation, bounded request bodies, explicit error paths, and MCP cancellation handling cover malformed and cancelled requests.          | closed |
| T-07-07   | Tampering                  | Host configuration       | low      | mitigate    | Timeout configuration is validated and written atomically; installer and doctor checks verify the expected integration paths and values.               | closed |

All identified threats have a disposition. No unresolved blocking threats remain.

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale                                                                                                                                                                | Accepted By          | Date       |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- | ---------- |
| R-07-01 | T-07-01    | The bridge is deliberately a local, single-user integration and does not add network authentication. Binding to loopback limits the trust boundary to the local machine. | Project architecture | 2026-07-16 |
| R-07-02 | T-07-03    | Detached state is intentionally in-memory; a bridge process restart cannot resume an orphaned round. The host can retry, and TTL bounds retained state.                  | Project architecture | 2026-07-16 |

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By                   |
| ---------- | ------------- | ------ | ---- | ------------------------ |
| 2026-07-16 | 7             | 7      | 0    | GSD phase security audit |

Evidence reviewed:

- `npm test`: 396 passing tests across 6 suites.
- `npm run lint`, `npm run format:check`, and `git diff --check`: passed.
- `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities.
- Real Codex CLI acceptance: the host detached after approximately 300 seconds and a fresh host resumed the same 15-question round successfully.
- Claude hook wire acceptance: 15-question flow returned a valid allow payload; the installed Claude model CLI could not be authenticated in this environment, so its model session was not used as security evidence.

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-16
