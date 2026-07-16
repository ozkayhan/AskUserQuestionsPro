# AskUserQuestionsPro Reliability and Documentation Overhaul

## What This Is

AskUserQuestionsPro is a local browser-based question interface that replaces cramped terminal prompts for Claude Code and Codex. Host adapters submit a question round to a single-user localhost bridge, the browser collects rich answers, and the result is returned to the originating host. This milestone hardens the whole system, with special focus on long-running rounds that currently close unexpectedly in Codex and may also fail in Claude Code.

## Core Value

Users must be able to complete a long, multi-question round at their own pace without the bridge, browser, or host integration timing out or losing their answers.

## Business Context

- **Customer**: Developers using Claude Code, Codex, and compatible MCP clients
- **Revenue model**: Open-source/npm-distributed developer tool
- **Success metric**: Long rounds complete reliably across supported hosts, with no unexplained early timeout or lost answer
- **Strategy notes**: Reliability and maintainability are the priority before adding new product capabilities

## Requirements

### Validated

- ✓ A localhost HTTP/SSE bridge can carry a question round from a host to the browser and return answers — existing
- ✓ Claude Code has a native `AskUserQuestion` hook integration — existing
- ✓ Codex/ChatGPT Desktop can use the MCP `ask` integration and installed `askpro` guidance — existing
- ✓ The browser supports typed questions, review/navigation, settings, themes, and accessibility behavior — existing
- ✓ Bridge, contract, client, host, installer, and UI behavior have broad automated tests — existing
- ✓ The runtime supports Node.js 18+, macOS/Linux/Windows host discovery, and zero production dependencies — existing
- ✓ Lifecycle events can correlate round boundaries and terminal reasons without logging question/answer payloads — Phase 1
- ✓ Automated coverage protects 15-question idle rounds and delayed stale-owner close behavior — Phase 1

### Active

- [ ] Identify and eliminate the root cause of premature timeout/closure during long question rounds in Codex.
- [ ] Determine whether the same failure exists in Claude Code and harden both host paths against equivalent lifecycle, transport, abort, and disconnect failures.
- [ ] Make timeout ownership and cancellation semantics explicit and observable across host adapters, bridge client, HTTP server, SSE, browser, and MCP.
- [ ] Audit and refactor all major layers: bridge/server coordination, browser state and accessibility, host integrations/installers/CLI, tests, packaging, and release workflow.
- [ ] Preserve the single-user localhost safety model, supported host compatibility, Node.js 18+ support, and zero-runtime-dependency invariant unless a deliberate decision changes them.
- [ ] Establish deterministic regression coverage for long rounds, idle user time, at least 15 questions, host disconnects, browser reconnects, cancellation, and stale rounds.
- [ ] Reorganize project documentation into a coherent maintained set with reliable names, indexes, and cross-links.
- [ ] Extract still-valid architecture decisions, constraints, and actionable findings from old plans/audits into current documentation.
- [ ] Archive or remove obsolete, duplicated, misleading, or empty planning documents after their durable knowledge has been recovered.
- [ ] Keep README, API/backend/frontend/testing/architecture documentation, release metadata, and implementation behavior consistent.

### Out of Scope

- A remote multi-user service, authentication system, database, or cloud persistence — the current product is intentionally a local single-user bridge.
- New question types or major product features unrelated to reliability and maintainability — stabilize the existing contract first.
- Replacing the zero-build, vendored-browser-asset distribution model without evidence that it is required to solve the reliability problem.
- Deleting historical documents solely because they are old — historical material is retained when it contains a decision, finding, or rationale that cannot be reconstructed safely.

## Context

- The codebase is brownfield and already has a codebase map under `.planning/codebase/`.
- The current architecture is a local single-process bridge: Claude hook and MCP adapters share `lib/bridge-client.mjs`; `server/bridge.js` owns a single pending round; `server/server.js` exposes localhost HTTP/SSE; the browser owns transient answer state.
- The observed failure is in Codex: while a user is answering a long round (for example, around question four of fifteen), the browser closes after an uncertain but possibly approximately five-minute interval. The user does not see a useful diagnostic message. Claude Code behavior is currently unknown and must be tested rather than assumed.
- Current code comments and tests indicate a one-hour client-side round timeout and `server.requestTimeout = 0`; a five-minute host/process/transport deadline, disconnect, abort propagation issue, or another lifecycle boundary therefore remains a leading hypothesis.
- Existing documents include maintained architecture/API/frontend/backend/testing references and an older `docs/old/` collection containing audit reports, plans, and historical decisions. The documentation work must recover durable knowledge before cleanup.
- Known fragile areas include round identity and single-flight coordination, module-load environment handling, browser state transitions, installer trust boundaries, mixed CommonJS/ESM modules, and release metadata drift.

## Constraints

- **Compatibility**: Keep Claude Code and Codex integrations working — they are the primary user-facing entry points.
- **Runtime**: Support Node.js 18+ and the existing supported host platforms — the package and installers depend on this baseline.
- **Packaging**: Preserve zero production dependencies and the current distribution contract unless a documented, justified decision changes it.
- **Safety**: Keep the bridge bound to `127.0.0.1` and unauthenticated only within that local single-user model — exposing it remotely would change the threat model.
- **Verification**: Every reliability change must have automated regression coverage and, where it crosses the browser/host boundary, a manual or integration-level verification path.
- **Documentation**: Preserve meaningful historical rationale and architecture decisions while removing stale duplication — cleanup must not erase project knowledge.

## Key Decisions

| Decision                                                                      | Rationale                                                                                     | Outcome   |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------- |
| Treat long-round completion as the primary reliability invariant              | The core product fails when users lose an in-progress round, regardless of other features     | — Pending |
| Diagnose lifecycle ownership before changing timeout constants                | Current app constants do not explain the observed host-scale closure; evidence is required    | ✓ Good    |
| Reserve live Codex/Claude acceptance for the final cross-host phase           | Local tests can prove bridge behavior, but host deadlines require a real host boundary        | — Pending |
| Audit Codex and Claude paths separately                                       | Their integration contracts differ: MCP for Codex versus native hook behavior for Claude      | — Pending |
| Make timeout/cancellation ownership explicit across boundaries                | A timeout reported by the browser may originate in the host, HTTP request, process, or bridge | — Pending |
| Use existing plans/audits as evidence, not as unquestioned scope              | Old documents may contain valuable decisions mixed with stale or duplicate work               | — Pending |
| Retain the local single-user, zero-runtime-dependency architecture by default | These are established product constraints and should only change with explicit evidence       | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):

1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):

1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

_Last updated: 2026-07-16 after Phase 1_
