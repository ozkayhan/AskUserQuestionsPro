# Project Research Summary

**Project:** AskUserQuestionsPro Reliability, Extensibility, and Productization — v1.1 Sprint 2
**Domain:** Local browser question bridge for AI coding hosts
**Researched:** 2026-07-17
**Confidence:** MEDIUM

## Executive Summary

AskUserQuestionsPro should be built as a durable, single-user local recovery system, not as a browser page held open by a host tool call. The correct authority is a versioned, private on-disk round record owned by the Node bridge. Browser IndexedDB/session state is useful only as a best-effort mirror. A host timeout, process exit, browser refresh, or SSE disconnect must detach an attachment—not discard a round or its immutable submitted result. The product should distinguish saved, delivery-pending, transport-delivered, and retained-result states, rather than reporting success when `/answer` merely returns.

Keep the established Node 18+, raw `node:http`, SSE, vendored React/Babel, localhost-only, zero-production-dependency architecture. Extend its existing atomic-write and validation chokepoints with per-round JSON snapshots, revisions, two-generation recovery, retention, and a single state coordinator. Build settings v2 as one versioned document and shared validation/migration contract; never let imports or UI controls alter executable host commands or the loopback-only security boundary.

Broad host support is a capability-and-evidence program, not an MCP logo wall. MCP stdio is the common transport, while Claude’s native hook stays a dedicated adapter. Claude Code and Codex are the Tier 1 baselines to harden first. A host becomes **Supported** only after version-pinned installation/doctor evidence, automated adapter conformance, and a real long-round/restart/cancel/delivery acceptance run; documented MCP support alone merits **Experimental** or **Researching**. This resolves the five-minute-class risk honestly: no portable timeout tweak can guarantee an indefinite host wait, but durable recovery and idempotent resume can prevent lost work.

Detailed evidence: [stack](STACK.md), [features](FEATURES.md), [architecture](ARCHITECTURE.md), and [pitfalls](PITFALLS.md).

## Key Findings

### Recommended Stack

Use the existing dependency-free distribution and add no database, ORM, server framework, frontend build step, remote service, or default Streamable HTTP endpoint. A bounded JSON snapshot store is the right fit for the product’s one-user, single-flight coordinator; it is portable on Node 18+, inspectable, and avoids native-package and migration burden. Strengthen the existing atomic-write chokepoint with temp-file write, sync, validation, atomic rename, bounded prior generation, and corrupt-record quarantine.

**Core technologies:**

- **Node.js built-ins (`fs`, `path`, `crypto`)** — private round files, cryptographically random durable identities, retention, and crash recovery without runtime dependencies.
- **One round JSON file plus compact index** — authoritative drafts and delivery records; revisioned, schema-versioned, and recoverable after bridge restart.
- **Raw `node:http` and SSE** — retain the local API; add revisioned draft/recovery/result/delivery-ack routes while remaining bound to `127.0.0.1`.
- **IndexedDB and Page Visibility APIs** — immediate browser mirror and opportunistic flush only; neither establishes durable recovery or delivery.
- **Shared settings schema and migration registry** — pure parsing, migration, serialization, defaulting, and cross-layer fixtures for settings v2.
- **MCP stdio tools** — primary host-facing transport, with JSON-RPC kept on stdout and diagnostics on stderr; do not add Streamable HTTP in this sprint unless a validated host actually requires it.
- **Capability manifest / adapter registry** — per-host install, timeout, cancellation, resume, approval, scope, evidence, and cleanup facts.

Critical version and compatibility requirements: preserve **Node.js 18+**, zero production dependencies, local-only unauthenticated loopback binding, and the current npm/shell distribution. MCP protocol compatibility must be negotiated rather than inferred; host support must be tied to a tested host version and date.

### Expected Features

**Must have (table stakes):**

- Durable draft save on meaningful edits, bounded retention, recovery inbox, and deterministic resume across refresh, browser closure, host disconnect, and bridge restart.
- Explicit lifecycle states for drafting, detached/reconnecting, saved-delivery-pending, delivered, delivery-uncertain, cancelled, recovery error, and expired.
- Idempotent submit/delivery retry with immutable final answers and a visible distinction between local acceptance and host-facing delivery.
- Honest timeout ownership and redacted lifecycle diagnostics; host deadlines must produce recovery guidance, not silent loss.
- Settings v2: versioned schema, shared validation, migrations, documented precedence, backup-before-import/migration, import preview/errors, export, and reset by namespace.
- Browser controls for reopening/selection and post-delivery closure, with closure attempted only after durable delivery and only where browser ownership permits it.
- Machine-readable host support matrix, adapter onboarding gate, doctor/install/uninstall evidence, and accessible recovery/settings flows.

**Should have (differentiators):**

- A privacy-preserving delivery-receipt timeline and redacted support bundle.
- Host-aware recovery instructions generated from actual capability data.
- One-command or native-manager onboarding only for hosts that have passed the evidence gate.
- Capability cards that state version, transport, approval model, tested scenarios, and limitation instead of claiming generic compatibility.

**Defer or explicitly reject:**

- Remote relay, cloud database, multi-user/authenticated service, or non-loopback default endpoint.
- SQLite/LevelDB/ORM, Express/Fastify, a frontend build migration, service worker, and a generic hook abstraction.
- New unrelated question types, host-specific extension binaries/marketplaces, and any host claim based solely on MCP discovery.

### Architecture Approach

Evolve `server/bridge.js` into a durable single-flight coordinator. It owns legal transitions, durable `roundKey`, revision checks, attachment leases, hydration, retention, and immutable result retrieval; it never lets a stale tab, delayed close, or expired host request target a different round. `server/server.js` remains the validated localhost/SSE boundary, while `lib/bridge-client.mjs` creates idempotency identity and treats caller abort as detachment. Browser code renders and reconciles draft/recovery state but never decides delivery completion. Settings and rounds remain separate persistence domains.

**Major components:**

1. **`round-schema` + `round-store`** — validate, migrate, atomically persist, quarantine, list, expire, and delete durable round snapshots.
2. **Durable round coordinator (`server/bridge.js`)** — single editable round, legal state machine, compare-and-swap revisions, attachment leases, and idempotent final-result access.
3. **Local HTTP/SSE boundary (`server/server.js`)** — validated round claim, draft, recovery, submit, result, settings, and event DTOs; no host policy hidden in routes.
4. **Browser draft/recovery controller** — cache/reconcile edits, show delivery state, preserve accessibility, and offer safe-close only after delivery.
5. **Settings codec and UI** — versioned envelope, pure migrations, settings namespaces, import/export/reset, and creation-time snapshots for round-affecting policy.
6. **Adapter registry** — normalized start/attach/detach/cancel/deliver-ack contract; Claude hook and MCP implementations preserve their distinct framing and fallback behavior.

### Critical Pitfalls

1. **Misattributing a host deadline to the bridge** — record the owning boundary and terminal reason; test real Claude/Codex 15-question idle rounds around observed deadlines before changing timeout values.
2. **Late, duplicate, or stale completion** — require unguessable round capabilities, revisions, delivery attempts, immutable answer hashes, and idempotent terminal transitions; test every race interleaving.
3. **Treating browser storage as durable/private** — make Node files authoritative, browser cache best-effort, storage failure visible, and retention/privacy explicit; test private mode, quota, port/origin drift, and restart.
4. **Silently accepting corruption or changing recovered answers** — persist question snapshot/hash, use two generations and checksum/schema validation, quarantine bad records, and fail closed rather than manufacture defaults.
5. **Turning settings into divergent toggles** — one document schema and precedence contract, pure idempotent migrations, backups, shared browser/Node corpus, and non-configurable security constraints.
6. **Equating MCP loadability with product support** — use the adapter capability gate; test real host process, trust/policy, approval, install/upgrade/uninstall, deadline, cancellation, recovery, and delivery behavior before a support claim.

## Implications for Roadmap

### Phase 1: Lifecycle Contract and Observability

**Rationale:** Every later feature depends on knowing whether a round is active, detached, submitted, delivery-pending, delivered, cancelled, expired, or corrupt. The current long-round failure cannot be fixed responsibly until timeout/cancellation ownership is observable.

**Delivers:** A documented state-transition table; durable round/attempt/correlation identity; attachment-versus-round semantics; redacted lifecycle events; deterministic clocks; race and stale-owner test matrix.

**Addresses:** Explicit lifecycle state, honest deadline handling, delivery acknowledgement semantics, and privacy-preserving diagnostics.

**Avoids:** Treating host deadline as bridge timeout, wrong-invocation completion, answer-bearing logs, and wall-clock-dependent tests.

### Phase 2: Durable Round Store and Recovery API

**Rationale:** Recovery must exist before UI polish, settings controls, or host breadth. Persisted state makes host cancellation recoverable instead of a lost promise.

**Delivers:** `roundKey` identity, versioned round schema/store, atomic two-generation persistence, startup hydration/expiry/quarantine, coordinator migration, revisioned claim/draft/submit/result APIs, and restart/corruption/concurrency coverage.

**Addresses:** Durable drafts, recovery inbox foundation, idempotent final delivery, bounded retention, and immutable recovered answers.

**Avoids:** Browser cache as authority, corrupt-draft fabrication, stale reconnect overwrite, and expiry based only on in-memory timers.

### Phase 3: Settings v2 Contract and Persistence

**Rationale:** Retention, recovery, browser, and lifecycle controls are public contracts; expose them only after their durable engine exists. Keeping settings isolated from round storage prevents configuration changes from rewriting in-progress commitments.

**Delivers:** Versioned settings envelope, namespaces, shared validation/migration registry, effective-precedence documentation, atomic backup/import/export/reset APIs, settings revisioning, and doctor output for effective non-sensitive values.

**Addresses:** Recovery/retention, delivery/lifecycle, browser, accessibility, adapter-enable, and portability controls.

**Avoids:** Silent reset, partial import, cross-layer validation drift, and unsafe configuration of host commands or loopback binding.

### Phase 4: Browser Recovery, Delivery, and Accessibility UX

**Rationale:** UI must consume the persisted contract, not invent its own completion model. This phase turns backend durability into comprehensible and accessible user trust.

**Delivers:** Browser cache/reconciliation, recovery inbox/resume, saved/delivery-pending/delivered/uncertain states, retry/copy guidance, opener/reopen controls, safe-close policy, live regions, focus behavior, and keyboard acceptance coverage.

**Addresses:** Recovery, confirmation, browser lifecycle controls, accessible settings/recovery flows, and delivery timeline differentiator.

**Avoids:** Premature tab close, invisible recovery conflict, origin/profile confusion, and ARIA/focus regression on restored rounds.

### Phase 5: Adapter Contract and Tier 1 Host Acceptance

**Rationale:** Extract host policy only after a stable generic round/result contract exists. Claude hook and Codex MCP are primary integrations and must be proven separately before adding candidates.

**Delivers:** Adapter descriptor/registry, fake-host conformance harness, Claude and Codex policy extraction without behavior loss, capability matrix, idempotent `ask`/`resume`/`status`/`cancel` semantics, doctor/install scope checks, and dated live evidence.

**Addresses:** Adapter onboarding gate, host-aware recovery guidance, current-host lifecycle reliability, and honest support-tier documentation.

**Avoids:** Generic adapter lifecycle assumptions, stdout contamination/fallback breakage, unsupported compatibility claims, and timeout changes without ownership proof.

### Phase 6: Evidence-Gated Host Expansion and Launch Hardening

**Rationale:** Add hosts one at a time through the same evidence gate, then publish only what has passed. Release quality must cover installation and recovery across platforms—not just unit tests.

**Delivers:** Prioritized experimental candidates (Cursor, Copilot CLI, Gemini CLI, Amazon Q, Cline, Kiro, Kilo, and Qwen only as evidence permits), per-host config writer/uninstaller/doctor, compatibility status page, unsupported explanations, docs/troubleshooting, package/release verification, and cross-host acceptance artifacts.

**Addresses:** Broad practical host coverage, capability cards, safe onboarding, packaging and documentation readiness.

**Avoids:** Broad config overwrite, enterprise/trust-policy circumvention, marketing unsupported hosts, and release regressions from fresh/upgrade/uninstall paths.

### Phase Ordering Rationale

- Durable identity and transition semantics precede files, UI, settings, and adapters because all must agree on exactly which immutable round/result they operate on.
- Persistence precedes settings and browser UX because those layers should configure and present a recovery contract, never substitute for it.
- Settings land before browser controls are publicly exposed so retention, close, and recovery policies have validated defaults, migration, and rollback.
- Tier 1 acceptance follows adapter extraction; live host evidence is the gate for claims, not an optimistic follow-up.
- Host expansion comes last and is individually promotable. No candidate should delay durable recovery or be bundled into a broad “all MCP hosts” release claim.

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 1:** Determine actual timeout/cancellation owner on installed, authenticated Codex and Claude versions; audit filesystem sync/directory durability by OS.
- **Phase 2:** Define legacy `/resume` migration for callers without a durable `roundKey`; verify crash behavior on macOS, Linux, and Windows.
- **Phase 3:** Decide exact settings v2 version boundary and import/unknown-future-version policy from existing settings fixtures.
- **Phase 5:** Mandatory host-by-host live acceptance: actual timeout, cancellation, request correlation, response-write semantics, hook fallback, and resume path for Claude and Codex.
- **Phase 6:** Mandatory per-candidate official-doc refresh plus installed-host acceptance. Research Roo Code and Windsurf configuration/lifecycle first; Aider remains unsupported pending an authoritative safe integration surface.

Phases with established patterns (research-phase usually optional):

- **Phase 4:** Browser reconciliation, live-region status, focus management, and safe-close fallback have clear inputs after Phase 2–3; use existing UI/a11y conventions and test contracts.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Primary Node/MCP/browser documentation supports the dependency-free local design; crash durability must still be tested on supported filesystems. |
| Features | MEDIUM | Public-launch requirements are consistently supported across reports and official platform guidance; exact defaults and UX wording require product decisions. |
| Architecture | MEDIUM | It aligns with checked-in single-flight bridge boundaries and primary protocol constraints; legacy migration and OS crash behavior remain implementation validation. |
| Pitfalls | MEDIUM | Strongly grounded in protocol/browser/host documentation and project history; actual host deadlines and cancellation semantics are version-specific. |

**Overall confidence:** MEDIUM. The recommended product direction is high-conviction; the scope of any individual host support claim is deliberately lower until live evidence exists.

### Gaps to Address

- **Documented capability vs verified support:** Claude, Codex, and candidate MCP hosts have documented integration surfaces. Only a version-pinned, installed-host acceptance run can verify long idle rounds, recovery after deadline/restart, cancellation, and delivery receipt. Do not label a host Supported before that artifact exists.
- **Timeout and acknowledgement semantics:** Capture exact default/configured host deadlines, cancellation signal timing, and what “response written” means for each host. “Delivered” can mean local transport handoff, not proof a model consumed bytes.
- **Filesystem and privacy guarantees:** Validate atomic-write recovery and restrictive permissions on macOS/Linux/Windows; define retention defaults, secure-deletion limits, browser-cache disclosure, private-mode behavior, and recovery URL/token exposure.
- **Legacy and migration compatibility:** Specify behavior for pre-durable request IDs and existing settings before implementation. Never select an arbitrary “latest” recoverable round.
- **Candidate hosts:** Re-verify current official docs/config scopes for Windsurf and Roo Code; treat Aider and proprietary/custom-tool-only surfaces as unsupported unless a separate safe adapter and acceptance evidence justify them.

## Sources

### Primary / official documentation

- [Model Context Protocol transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports), [lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle), and [cancellation](https://modelcontextprotocol.io/specification/latest/basic/utilities/cancellation) — stdio, lifecycle, and cancellation limitations.
- [Node.js filesystem API](https://nodejs.org/api/fs.html) and [Node 18 HTTP timeout documentation](https://nodejs.org/download/release/v18.9.0/docs/api/http.html) — local persistence and HTTP timeout behavior.
- [MDN IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB), [storage quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria), and [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) — browser cache and lifecycle limits.
- [Claude Code hooks](https://code.claude.com/docs/en/hooks) and [MCP](https://code.claude.com/docs/en/mcp) — dedicated hook and MCP capability surface.
- [OpenAI Codex MCP](https://developers.openai.com/codex/mcp) and [Codex manual](https://developers.openai.com/codex/codex-manual.md) — MCP configuration, timeout, and trust facts.
- [Cursor MCP](https://docs.cursor.com/context/model-context-protocol), [GitHub Copilot CLI MCP](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers), [Gemini CLI MCP](https://geminicli.com/docs/tools/mcp-server/), [Amazon Q MCP](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/qdev-mcp.html), [Kiro MCP](https://kiro.dev/docs/cli/mcp/configuration/), [Qwen Code MCP](https://qwenlm.github.io/qwen-code-docs/en/users/features/mcp/), [Kilo Code MCP](https://kilo.ai/docs/automate/mcp/using-in-kilo-code), and [OpenCode tools](https://opencode.ai/docs/tools/) — documented candidate host surfaces only.

### Project research

- [STACK.md](STACK.md) — stack, lifecycle, host tiers, packaging, and source evidence.
- [FEATURES.md](FEATURES.md) — table stakes, differentiators, support UX, and scope boundaries.
- [ARCHITECTURE.md](ARCHITECTURE.md) — coordinator/store design, state transitions, adapter contract, and build order.
- [PITFALLS.md](PITFALLS.md) — race, persistence, settings, integration, installer, accessibility, and release risks.

---
*Research completed: 2026-07-17*
*Ready for roadmap: yes*
