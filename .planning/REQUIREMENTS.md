# Requirements: AskUserQuestionsPro Reliability and Documentation Overhaul

**Defined:** 2026-07-16
**Core Value:** Users must be able to complete a long, multi-question round at their own pace without the bridge, browser, or host integration timing out or losing their answers.

## v1 Requirements

### Timeout and Observability

- [x] **TIME-01**: User can complete a 15-question Codex round after the host's observed 300-second boundary without the browser round or answers being lost; a fresh MCP process resumes the exact answers within the bounded one-hour window.
- [x] **TIME-02**: The Claude hook wire path completes an equivalent 15-question round and preserves native fallback; the installed Claude CLI could not run a model session because it was not authenticated, so no unsupported Claude host deadline claim is made.
- [x] **TIME-03**: Maintainers can identify whether a failed round ended by host cancellation, HTTP disconnect, bridge cancellation, browser disconnect, application timeout, or process exit without inspecting question contents.
- [x] **TIME-04**: A failed host connection produces a clear recoverable diagnostic and does not silently look like a normal browser close.

### Host Integrations

- [x] **HOST-01**: Codex MCP `tools/call` preserves the existing `ask` input/output contract while supporting the selected long-round lifecycle fix.
- [x] **HOST-02**: Claude Code native hook preserves its existing fallback contract while using the shared lifecycle/error semantics.
- [x] **HOST-03**: A host failure or cancellation leaves the user with a documented, actionable native-host fallback path.

### Bridge and Server Reliability

- [x] **BRDG-01**: Every active round has stable request and round ownership that is checked by resolve, cancel, disconnect, and reconnect paths.
- [x] **BRDG-02**: User cancellation, host cancellation, browser disconnect, and application timeout are distinct idempotent terminal outcomes.
- [x] **BRDG-03**: A stale or mismatched answer can never resolve a later round and receives a deterministic conflict response.
- [x] **BRDG-04**: A dropped `/ask` connection cannot cancel a newer round and cannot leave an unbounded orphaned pending round.
- [x] **BRDG-05**: The bridge remains localhost-only, single-flight, and safe across daemon startup races and process restarts.

### Browser Interaction and Accessibility

- [x] **WEB-01**: Browser navigation, review, and answer state remain consistent for long rounds and never submit stale round data.
- [x] **WEB-02**: Browser SSE reconnect behavior is bounded, observable, and safe; reconnecting to a new round cannot reuse old answers.
- [x] **WEB-03**: Timeout, disconnect, and server errors are presented as distinct actionable UI states while native fallback remains possible.
- [x] **WEB-04**: Existing typed question behavior, keyboard navigation, review flow, and accessibility semantics remain intact after refactoring.

### Refactor, Tests, and Quality

- [x] **REF-01**: Timeout, cancellation, request identity, and lifecycle logging contracts have one documented/shared ownership model across host, bridge, server, and browser layers.
- [x] **TEST-01**: Automated tests cover long idle rounds, 15+ questions, host aborts, HTTP disconnects, browser reconnects, cancellation, stale rounds, and process failure.
- [x] **TEST-02**: Real MCP stdio plus localhost browser-answer wire tests exercise a 15-question Codex detach/resume round, and the Claude hook wire path returns its real `PreToolUse` payload.
- [x] **TEST-03**: The full quality suite remains green: tests, lint, formatting, shell checks, package audit, and relevant release checks.
- [x] **PKG-01**: Node.js 18+, supported host platforms, zero production dependencies, and published file boundaries remain verified.
- [x] **TOOL-01**: CLI, doctor, install, uninstall, reinstall, host detection, and release metadata behavior are audited and corrected where stale or unsafe.

### Documentation

- [x] **DOC-01**: Maintained documentation has a coherent index and stable descriptive filenames with no dead internal links.
- [x] **DOC-02**: Current architecture, lifecycle invariants, timeout ownership, host differences, and recovery procedures are documented against verified source behavior.
- [x] **DOC-03**: Valid architecture decisions and actionable findings from old audit/plan documents are extracted into maintained docs or planning artifacts with provenance.
- [x] **DOC-04**: Obsolete, duplicate, empty, or misleading documents are archived or removed only after inbound references and durable knowledge are handled.
- [x] **DOC-05**: README, API, backend, frontend, testing, architecture, tech-stack, and troubleshooting documents agree with the implementation and release contract.

## v2 Requirements

### Resumable Host Sessions

- **RESM-01**: A hard host tool-call deadline can be bypassed with a durable resumable round/ticket protocol while preserving answer ownership and cleanup.
- **RESM-02**: A user can resume an interrupted round across host process restarts without losing already submitted answers.

### Product Expansion

- **PROD-01**: Multiple simultaneous users or remote clients can use isolated authenticated sessions.
- **PROD-02**: The bridge persists rounds and answers in a remote or durable database.

## Out of Scope

| Feature                                      | Reason                                                                                 |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| Remote multi-user service and authentication | Changes the intentional local single-user threat and state model                       |
| New question types                           | Increases contract surface while lifecycle reliability is still being repaired         |
| Full frontend build-system migration         | Not justified unless runtime Babel/vendored assets are proven causal                   |
| Blindly increasing timeout constants         | Does not solve host hard deadlines or disconnect ownership                             |
| Destructive deletion of historical documents | Old audit/plan material may contain decisions and findings needed for safe maintenance |

## Traceability

| Requirement | Phase   | Status   |
| ----------- | ------- | -------- |
| TIME-01     | Phase 7 | Complete |
| TIME-02     | Phase 7 | Complete |
| TIME-03     | Phase 1 | Complete |
| TIME-04     | Phase 2 | Complete |
| HOST-01     | Phase 2 | Complete |
| HOST-02     | Phase 2 | Complete |
| HOST-03     | Phase 2 | Complete |
| BRDG-01     | Phase 3 | Complete |
| BRDG-02     | Phase 3 | Complete |
| BRDG-03     | Phase 3 | Complete |
| BRDG-04     | Phase 3 | Complete |
| BRDG-05     | Phase 3 | Complete |
| WEB-01      | Phase 4 | Complete |
| WEB-02      | Phase 4 | Complete |
| WEB-03      | Phase 4 | Complete |
| WEB-04      | Phase 4 | Complete |
| REF-01      | Phase 7 | Complete |
| TEST-01     | Phase 1 | Complete |
| TEST-02     | Phase 7 | Complete |
| TEST-03     | Phase 5 | Complete |
| PKG-01      | Phase 5 | Complete |
| TOOL-01     | Phase 5 | Complete |
| DOC-01      | Phase 6 | Complete |
| DOC-02      | Phase 6 | Complete |
| DOC-03      | Phase 6 | Complete |
| DOC-04      | Phase 6 | Complete |
| DOC-05      | Phase 6 | Complete |

**Coverage:**

- v1 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0 ✓

---

_Requirements defined: 2026-07-16_
_Last updated: 2026-07-16 after initial scope definition_
