# Roadmap: AskUserQuestionsPro Reliability and Documentation Overhaul

## Overview

This milestone turns the observed Codex long-round timeout into a measurable, host-aware reliability contract, then hardens the shared bridge, browser, integrations, tooling, and documentation around that contract. The work proceeds as vertical MVP slices: each phase produces an observable improvement and regression evidence before the next layer is refactored.

## Phases

- [x] **Phase 1: Timeout Diagnosis & Observability** - Reproduce the early closure and identify the true lifecycle owner with redacted diagnostics. (completed 2026-07-16)
- [ ] **Phase 2: Host Lifecycle Fix** - Make Codex reliable and verify the equivalent Claude Code path and fallback behavior.
- [ ] **Phase 3: Bridge & Server Round Reliability** - Harden ownership, cancellation, disconnect, stale-round, and daemon lifecycle contracts.
- [ ] **Phase 4: Browser State & Recovery** - Make long-round browser state, SSE reconnects, errors, and accessibility behavior resilient.
- [ ] **Phase 5: Tooling, Packaging & Release** - Audit CLI, installers, host detection, package boundaries, and quality gates.
- [ ] **Phase 6: Documentation Consolidation** - Create a coherent maintained documentation set and evidence-preserving historical archive.
- [ ] **Phase 7: Cross-Host Hardening & Acceptance** - Run full wire/host verification, close integration gaps, and lock the milestone contracts.

## Phase Details

### Phase 1: Timeout Diagnosis & Observability

**Goal:** Determine exactly which host, transport, process, or application boundary ends a long question round and make that evidence available to maintainers.
**Mode:** mvp
**Depends on:** Nothing (first phase)
**Requirements:** [TIME-03, TEST-01]
**Success Criteria** (what must be TRUE):

  1. A repeatable 15-question test matrix records Codex and Claude outcomes at multiple idle durations, including at least one run beyond five minutes.
  2. Logs identify round registration, browser opening, answer, response close, abort, cancellation, timeout, and process-exit reasons without logging question contents or answers.
  3. The team can distinguish a host hard deadline from an application timeout, HTTP disconnect, SSE failure, or browser failure using automated evidence.
  4. Regression tests fail if a lifecycle terminal reason is collapsed into an untyped generic timeout.

**Plans:** 2/2 plans complete

Plans:

- [x] 01-01: Add redacted lifecycle correlation and timeout diagnostics.
- [x] 01-02: Build deterministic long-round, disconnect, and host-boundary regression harness.

### Phase 2: Host Lifecycle Fix

**Goal:** Prevent the host integration from prematurely destroying a usable long-running round, with Codex as the primary target and Claude behavior explicitly verified.
**Mode:** mvp
**Depends on:** Phase 1
**Requirements:** [TIME-04, HOST-01, HOST-02, HOST-03]
**Success Criteria** (what must be TRUE):

  1. A Codex user can complete a 15-question round after at least 10 minutes of idle time without the custom browser closing unexpectedly.
  2. The selected host-lifecycle strategy is tested against real JSON-RPC/MCP cancellation and response behavior, not only internal mocks.
  3. Claude Code either passes the equivalent long-round test or has a proven host-specific limitation with an explicit supported fallback.
  4. Host errors and fallback guidance identify the actionable cause instead of silently presenting a generic close.

**Plans:** 2 plans

Plans:

- [ ] 02-01: Implement the evidence-backed Codex/Claude lifecycle fix and typed host errors.
- [ ] 02-02: Verify host cancellation, keepalive/progress or resumable fallback behavior end to end.

### Phase 3: Bridge & Server Round Reliability

**Goal:** Make round ownership and terminal-state behavior deterministic across HTTP, bridge, daemon, and stale/disconnected clients.
**Mode:** mvp
**Depends on:** Phase 2
**Requirements:** [BRDG-01, BRDG-02, BRDG-03, BRDG-04, BRDG-05]
**Success Criteria** (what must be TRUE):

  1. Resolve, cancel, disconnect, and reconnect operations require the correct request/round owner and are idempotent.
  2. A delayed close from an old `/ask` request cannot cancel or resolve a newer round.
  3. Stale answers, concurrent rounds, malformed bodies, and daemon startup races return deterministic safe responses.
  4. Process restart and server errors leave no silent orphan or cross-round answer path.

**Plans:** 2 plans

Plans:

- [ ] 03-01: Refactor bridge/server lifecycle state and ownership contracts.
- [ ] 03-02: Expand HTTP, concurrency, disconnect, and daemon regression coverage.

### Phase 4: Browser State & Recovery

**Goal:** Keep the full-screen UI correct and recoverable during long rounds, SSE reconnects, errors, navigation, and accessibility interactions.
**Mode:** mvp
**Depends on:** Phase 3
**Requirements:** [WEB-01, WEB-02, WEB-03, WEB-04]
**Success Criteria** (what must be TRUE):

  1. Long-round navigation, review, back/jump behavior, and answer submission never use stale state.
  2. SSE reconnects are bounded and round-aware; a new round cannot inherit old answers.
  3. Timeout, disconnect, server conflict, and retry states are visibly distinct and actionable.
  4. Existing question types, keyboard shortcuts, focus management, and accessibility semantics remain verified.

**Plans:** 2 plans

Plans:

- [ ] 04-01: Refactor live transport and browser round state around explicit lifecycle states.
- [ ] 04-02: Harden UI error/retry/accessibility behavior and browser-compatible tests.

### Phase 5: Tooling, Packaging & Release

**Goal:** Remove reliability and maintenance hazards in CLI, installers, host discovery, package metadata, and quality gates.
**Mode:** mvp
**Depends on:** Phase 3
**Requirements:** [TEST-03, PKG-01, TOOL-01]
**Success Criteria** (what must be TRUE):

  1. CLI doctor, serve, mcp, install, uninstall, and reinstall report actionable failures and handle process/host errors safely.
  2. Node 18+, supported platform behavior, zero runtime dependencies, package allowlists, and version metadata are consistent and tested.
  3. Full automated tests, lint, formatting, shell checks, audit, and release checks pass from a clean checkout.
  4. Installer changes preserve idempotency, safe cleanup, and host registration boundaries.

**Plans:** 2 plans

Plans:

- [ ] 05-01: Audit and harden CLI/installers/host platform operations.
- [ ] 05-02: Align package/release metadata and run complete quality gates.

### Phase 6: Documentation Consolidation

**Goal:** Replace the scattered documentation system with verified current references, a timeout runbook, and an evidence-preserving historical archive.
**Mode:** mvp
**Depends on:** Phases 2, 3, 4, and 5
**Requirements:** [DOC-01, DOC-02, DOC-03, DOC-04, DOC-05]
**Success Criteria** (what must be TRUE):

  1. The docs index has stable names, clear ownership, and no dead internal links.
  2. Architecture, API, backend, frontend, testing, host differences, timeout ownership, and recovery instructions match verified source behavior.
  3. Durable decisions and actionable findings from old audit/plan documents are extracted with provenance before cleanup.
  4. Empty, duplicate, obsolete, and misleading documents are archived or removed according to documented rules without deleting needed rationale.

**Plans:** 2 plans

Plans:

- [ ] 06-01: Consolidate current references and create the reliability troubleshooting/runbook document.
- [ ] 06-02: Classify, migrate, archive/remove historical documents and repair indexes/cross-links.

### Phase 7: Cross-Host Hardening & Acceptance

**Goal:** Prove the integrated system satisfies the core reliability invariant across supported hosts and lock the shared lifecycle contract for future work.
**Mode:** mvp
**Depends on:** Phases 1-6
**Requirements:** [TIME-01, TIME-02, REF-01, TEST-02]
**Success Criteria** (what must be TRUE):

  1. Codex and Claude end-to-end verification covers long idle rounds, host cancellation, browser reconnect, stale answers, and recovery.
  2. A real browser-to-server-to-host wire path passes with at least 15 questions and no unexplained early close.
  3. Lifecycle ownership, timeout policy, fallback behavior, and operational diagnostics are documented as one coherent contract.
  4. All phase regressions and quality gates pass together from a clean checkout.

**Plans:** 2 plans

Plans:

- [ ] 07-01: Run cross-host integration acceptance and close remaining contract gaps.
- [ ] 07-02: Final audit, verification evidence, and milestone handoff.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Timeout Diagnosis & Observability | 2/2 | Complete    | 2026-07-16 |
| 2. Host Lifecycle Fix | 0/2 | Not started | - |
| 3. Bridge & Server Round Reliability | 0/2 | Not started | - |
| 4. Browser State & Recovery | 0/2 | Not started | - |
| 5. Tooling, Packaging & Release | 0/2 | Not started | - |
| 6. Documentation Consolidation | 0/2 | Not started | - |
| 7. Cross-Host Hardening & Acceptance | 0/2 | Not started | - |
