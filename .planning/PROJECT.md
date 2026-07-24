# AskUserQuestionsPro Reliability, Extensibility, and Productization

## Current State

v1.2.0 Bug Fixes shipped locally on 2026-07-24. The browser now retires a submitted round before delivery, closes only after acknowledgement, permanently gates retired tabs from later snapshots, and exposes recovery only for exact recoverable records with state-specific actions and copy. The saved-round conflict regression is also fixed: normal draft acknowledgement no longer races the browser conflict detector.

Automated Phase 19 regressions, lint, formatting, and localhost browser smoke pass. The milestone was archived with an explicit override because seven configured-host, visual, and assistive-technology UAT lanes remain `human_needed`; see `.planning/milestones/v1.2.0-MILESTONE-AUDIT.md` and the archived Phase 19 UAT.

## What This Is

AskUserQuestionsPro is a local browser-based question interface that replaces cramped terminal prompts for AI coding agents and IDEs. Host adapters submit a question round to a single-user localhost bridge, the browser collects rich answers, and the result is returned to the originating host. The product is a reliable, configurable, adapter-driven question platform for supported AI coding hosts.

## Core Value

Users must be able to complete and safely deliver a long, multi-question round at their own pace without losing answers, regardless of which supported AI coding host initiated it.

## Business Context

- **Customer**: Developers using Claude Code, Codex, and compatible MCP clients
- **Revenue model**: Open-source/npm-distributed developer tool
- **Success metric**: Public users complete long rounds across supported hosts with zero unexplained early closures or lost answers, and new host adapters can be added from documented evidence without bespoke guesswork
- **Strategy notes**: Quality, reliability, and maintainability take priority over breadth claims; unsupported hosts must be reported honestly

## Requirements

### Validated

- ✓ Localhost HTTP/SSE bridge carries question rounds from supported hosts to the browser and returns answers — existing
- ✓ Claude Code hook and Codex/ChatGPT Desktop MCP integrations remain installed and doctor-validated — existing
- ✓ Browser typed questions, review/navigation, settings, themes, accessibility behavior, drafts, recovery, and acknowledgement lifecycle are covered by implementation contracts and local regression suites — v1.2.0
- ✓ Runtime supports Node.js 18+, macOS/Linux/Windows host discovery, localhost-only binding, and zero production dependencies — existing
- ✓ Duplicate completed tabs are retired and cannot render later rounds — v1.2.0
- ✓ Normal delivery stays free of unrelated recovery prompts; genuine recovery uses exact identity and state-valid actions — v1.2.0

### Active

No next-milestone requirements have been defined yet. Use `/gsd-new-milestone` to define them.

## Out of Scope

- A remote multi-user service, authentication system, database, or cloud persistence — the current product remains a local single-user bridge.
- Claiming support for a host whose lifecycle and delivery guarantees cannot be demonstrated — it receives an explicit unsupported explanation.
- Replacing the zero-build, vendored-browser-asset distribution model without evidence that a supported-host capability requires it.
- New question types unrelated to reliability, configurability, or host extensibility.
- Deleting historical documents solely because they are old; rationale and bounded evidence remain archived.

## Constraints

- **Compatibility**: Keep Claude Code and Codex integrations working.
- **Runtime**: Support Node.js 18+ and existing supported host platforms.
- **Packaging**: Preserve zero production dependencies and the current distribution contract unless justified.
- **Safety**: Keep the bridge bound to `127.0.0.1`.
- **Verification**: Reliability changes require automated regression coverage and boundary changes require manual or integration evidence.
- **Documentation**: Preserve meaningful rationale while removing stale duplication.

## Key Decisions

| Decision | Rationale | Outcome |
| --- | --- | --- |
| Treat long-round completion as the primary reliability invariant | Losing an in-progress round is the core product failure | ✓ Good |
| Diagnose lifecycle ownership before changing timeout constants | Evidence is required before changing host-scale behavior | ✓ Good |
| Reserve live Codex/Claude acceptance for a real host boundary | Local tests cannot prove authenticated host deadlines | ⚠️ Revisit when host evidence is available |
| Retain the local single-user, zero-runtime-dependency architecture | These constraints protect installation and threat-model simplicity | ✓ Good |
| Treat host integrations as evidence-gated capability adapters | Protocol similarity alone does not prove lifecycle compatibility | ✓ Good |
| Prefer durable local recovery over optimistic timeout removal | Host or OS deadlines can remain outside bridge control | ✓ Good |
| Retire a successfully delivered browser round before later rounds can render | Completed tabs must not duplicate future rounds | ✓ Good — v1.2.0 |
| Explain recovery only for an actual recoverable local-server state | Normal delivery should not look like an error | ✓ Good — v1.2.0 |

## Known Deferred Work

- Phase 19’s seven external UAT lanes remain in `human_needed` state; rerun `/gsd-verify-work 19` with configured Claude/Codex host access before promoting cross-host/browser claims.
- Authenticated Claude/Codex and native Windows/Linux evidence remain unavailable until owner-supplied runs.
- The historical v1.1.1 release handoff contains one dead link to a missing archived Phase 16 verification artifact; it is recorded in the v1.2.0 audit rather than silently rewritten.

## Context

The codebase is brownfield and uses a local single-process bridge: Claude hook and MCP adapters share `lib/bridge-client.mjs`; `server/bridge.js` owns a single pending round; `server/server.js` exposes localhost HTTP/SSE; and the browser owns transient answer state while durable rounds remain Node-owned. The project retains its codebase map under `.planning/codebase/`, maintained docs under `docs/`, and historical evidence under `.planning/milestones/`.

---
*Last updated: 2026-07-24 after v1.2.0 milestone*
