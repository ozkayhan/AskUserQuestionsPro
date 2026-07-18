# AskUserQuestionsPro Reliability, Extensibility, and Productization

## Current Milestone: v1.2 Multilingual, Responsive, and Branching Question Experience

**Goal:** Make question rounds usable in the user's language, responsive across devices, visually refreshed, and expressive enough for host-defined story metadata and conditional question trees.

**Target features:**

- Localized browser UI labels, controls, question text, and answer presentation without changing the English structured host contract or skill metadata.
- A responsive visual redesign with refreshed tokens, typography, layout, settings presentation, and accessibility-preserving interaction behavior.
- Visible story-type metadata, architecture pros/cons capture, and an explicit agent-decision answer option.
- A declarative, host-provided question tree whose answers can control later question visibility and option sets while keeping AI out of the browser UI.

## What This Is

AskUserQuestionsPro is a local browser-based question interface that replaces cramped terminal prompts for AI coding agents and IDEs. Host adapters submit a question round to a single-user localhost bridge, the browser collects rich answers, and the result is returned to the originating host. The product is evolving from a reliable Claude Code/Codex integration into a durable, configurable, adapter-driven question platform that can be safely extended to new AI coding hosts.

## Latest Milestone: v1.1 Sprint 2 — shipped 2026-07-17

**Outcome:** The reliability, settings, browser recovery, adapter, host-evidence, and launch-hardening work shipped locally. Public support promotion remains evidence-gated where authenticated host or native OS evidence is unavailable.

**Target features:**

- Durable answer drafts, recovery, resume, and delivery confirmation so browser/host interruptions cannot discard completed work.
- An explicit no-surprise lifecycle contract covering timeout ownership, reconnects, cancellation, browser selection, and safe post-submit tab closure.
- A redesigned, extensible settings system with comprehensive user controls, validation, persistence, migration, and reliable UI behavior.
- A documented adapter capability model and repeatable evidence-based onboarding workflow for new AI coding IDEs/agents.
- Research-backed integrations for the broadest practical set of AI coding IDEs/agents, with clear unsupported-status explanations where a host cannot safely integrate.
- Cross-host compatibility, reliability, accessibility, packaging, and release verification suitable for public launch.

## Current State

Milestone v1.0.0 shipped on 2026-07-16 and v1.1 shipped on 2026-07-17. v1.1.1 release hardening closed the local lint/format, test, browser-smoke, security, package, installer, and documentation gates. A patch changeset is prepared; merge of the release PR followed by the generated Version Packages PR will update metadata to 1.1.1 and publish through `NPM_TOKEN`. Authenticated host runs, native Linux/Windows runs, and some browser/AT scenarios remain explicit evidence handoffs.

## Core Value

Users must be able to complete and safely deliver a long, multi-question round at their own pace without losing answers, regardless of which supported AI coding host initiated it.

## Business Context

- **Customer**: Developers using Claude Code, Codex, and compatible MCP clients
- **Revenue model**: Open-source/npm-distributed developer tool
- **Success metric**: Public users complete long rounds across supported hosts with zero unexplained early closures or lost answers, and new host adapters can be added from documented evidence without bespoke guesswork
- **Strategy notes**: Quality, reliability, and maintainability take priority over breadth claims; unsupported hosts must be reported honestly

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
- ✓ Settings v2 provides validated persistence, migration, import/export/reset, doctor output, and accessible browser controls — Phase 10

### Validated in v1.1

- ✓ Preserve every answer draft through browser refresh, reconnect, host disconnect, process restart, and exact resumable recovery — Phases 8–11.
- ✓ Make timeout/cancellation ownership explicit and preserve recovery at unavoidable host deadlines — Phase 8.
- ✓ Verify delivery before completion or browser closure through durable acknowledgement — Phase 11.
- ✓ Define the adapter contract and evidence-gated onboarding workflow — Phase 12.
- ✓ Evaluate relevant hosts without unverified support claims and document unsupported states — Phase 13.
- ✓ Make browser launch, lifecycle UX, reconnect/recovery, and post-submit behavior configurable — Phases 10–11.
- ✓ Preserve accessibility, Node.js 18+, localhost-only safety, zero production dependencies, and packaging compatibility — Phases 8–13.
- ✓ Publish maintained settings, recovery, adapter, compatibility, troubleshooting, privacy, and release documentation — Phases 10–13.

### Active in v1.2

- Support user-facing browser UI and question content in the user's selected or detected language, with a safe fallback and no localization of structured internal metadata.
- Refresh the browser design system and responsive layouts while preserving current round lifecycle, settings, recovery, delivery, and host integration behavior.
- Render a story type for every question, support architecture-specific pros/cons capture, and let the agent provide a clearly labeled decision option.
- Represent the full conditional question tree in the host-provided round contract so answers can gate questions and option sets without browser-side AI or hidden network calls.

### Out of Scope

- A remote multi-user service, authentication system, database, or cloud persistence — the current product is intentionally a local single-user bridge.
- Claiming support for a host whose documented or tested integration surface cannot safely preserve the product’s lifecycle and delivery guarantees — it receives an explicit unsupported explanation instead.
- Replacing the zero-build, vendored-browser-asset distribution model unless research demonstrates it is required for a specific supported-host capability.
- New question types unrelated to reliability, configurability, or host extensibility — the existing question contract remains the compatibility baseline.
- Deleting historical documents solely because they are old — durable rationale and evidence must be preserved before cleanup.

## Context

- The codebase is brownfield and already has a codebase map under `.planning/codebase/`; v1.0.0 shipped on 2026-07-16 with 397 tests, lint, and formatting passing.
- The current architecture is a local single-process bridge: Claude hook and MCP adapters share `lib/bridge-client.mjs`; `server/bridge.js` owns a single pending round; `server/server.js` exposes localhost HTTP/SSE; the browser owns transient answer state.
- v1.0.0 added detach/resume and browser recovery, but the next milestone must turn those mechanisms into durable, user-visible guarantees rather than relying on transient process memory alone.
- The target audience may include large numbers of Product Hunt users, so settings migrations, compatibility claims, recovery semantics, installer behavior, and documentation must be treated as public product contracts.
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
- **Quality**: Research official host documentation and install/test each candidate integration where feasible; do not infer compatibility from branding or protocol similarity alone.

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
| Treat host integrations as capability adapters with evidence gates            | Different AI coding hosts expose different lifecycle, transport, and installation contracts  | — Pending |
| Prefer durable local recovery over optimistic timeout removal                  | A host or OS boundary can remain outside the bridge’s control; user work must still survive   | — Pending |
| Make settings schema/versioning a public contract                              | A larger user base makes silent reset or migration failure unacceptable                       | ✓ Good    |

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

_Last updated: 2026-07-18 after v1.2 milestone definition_
