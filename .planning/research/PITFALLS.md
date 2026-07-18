# Domain Pitfalls: Durable Local Question Bridge

**Project:** AskUserQuestionsPro v1.1 Sprint 2
**Researched:** 2026-07-17
**Overall confidence:** MEDIUM — official protocol, browser, npm, and several host documents were checked. Exact deadlines and event behavior still require version-pinned local acceptance runs for every claimed host.

## Phase Model Used by This Report

1. **Lifecycle contract and observability** — terminal-state model, correlation IDs, timeout/cancellation ownership, delivery acknowledgement.
2. **Durable draft and recovery** — crash-safe local persistence, restart/recovery, retention, and privacy UX.
3. **Versioned settings** — schema, migrations, import/export/reset, validation, and compatibility.
4. **Adapter contract and host evidence** — capability matrix, per-host installers/configuration, contract tests, and unsupported decisions.
5. **Launch hardening** — browser UX/accessibility, packaging/install trust, docs, and cross-host release acceptance.

## Critical Pitfalls

### 1. Treating a host deadline as a bridge timeout

**What goes wrong:** The Node server can correctly set `server.requestTimeout = 0` and the browser can remain open, yet the host kills the hook/tool call. Raising a local timeout hides the owner of the failure and leaves a browser tab that can no longer deliver to its originating call. Codex currently documents separate MCP startup and tool timeouts (10 seconds and 60 seconds by default), while hook commands have their own configured timeout. This makes a browser-mediated MCP tool call intrinsically vulnerable unless the host-specific limit is configured and proven. [Codex manual](https://developers.openai.com/codex/codex-manual.md) [MEDIUM]

**Why it happens:** Timeout policies exist independently in the host, hook runner, stdio/MCP client, HTTP client, process supervisor, OS sleep behavior, and browser. Only some are application-controlled.

**Consequences:** Apparent random closure at a stable wall-clock time, duplicate recovery attempts, a falsely reported “submitted” state, or unrecoverable host context even though the user’s browser answers survived.

**Prevention:** Assign one owner for each deadline in the lifecycle contract. Persist a `roundId`, `attemptId`, `originHost`, `createdAt`, `expiresAt`, and terminal reason before waiting. Distinguish `host_deadline`, `host_disconnect`, `browser_disconnect`, `user_cancel`, `delivery_pending`, and `delivered`; never map all of them to “timeout.” For an unavoidable host deadline, detach the durable round, show that the host must resume/retry, and retain a one-time delivery token rather than keeping a dead promise alive.

**Detection / release evidence:** Structured lifecycle events (with IDs and timestamps but no question/answer text) must show which boundary ended the original call. Test 15-question idle runs at 1x, just-below, and just-above each host deadline, then manually run the real Claude and Codex paths. A host cannot be marked supported until its effective tool/hook deadline and resume behavior are documented from the installed version.

**Roadmap phase:** Phase 1, with a Phase 4 per-host acceptance gate.

### 2. Late, duplicate, or stale completion resolves the wrong invocation

**What goes wrong:** A browser retry, an SSE reconnect, a reissued host request, and a delayed close can all race. If the bridge accepts answers by question text or current-round state alone, a previous browser tab can complete a newer round. If it retries delivery after an ambiguous disconnect, the host can receive duplicate answers. MCP explicitly calls out cancellation races: cancellation can arrive after completion, a receiver should not answer a cancelled request, and senders should ignore responses that arrive after cancellation. [MCP cancellation specification](https://modelcontextprotocol.io/specification/latest/basic/utilities/cancellation) [MEDIUM]

**Why it happens:** “At least once” transport behavior is accidentally combined with an “exactly once” product promise without an idempotency protocol.

**Consequences:** Wrong answer delivery is worse than a visible failure: the agent can take irreversible action from another round’s answers, while the user sees a plausible UI.

**Prevention:** Model the server as an explicit persisted state machine: `draft → submitted → delivery_pending → delivered | cancelled | expired`. Require an unguessable per-round capability plus monotonically increasing `deliveryAttempt`; bind every `/draft`, `/answer`, resume, and terminal request to it. Make final delivery idempotent: same delivery key returns the original terminal result, while a different/stale key receives a conflict without mutating state. Acknowledgement must be a durable state transition, not merely HTTP socket write success. Do not use question text as identity.

**Detection / release evidence:** Wire tests must simulate: answer POST retransmission, duplicate browser tab, SSE reconnection, stale owner socket close after a new owner registers, cancellation immediately before/after answer, host result write failure, and process death between receipt and acknowledgement. A test fixture should assert exactly one terminal outcome and one observable host delivery attempt for every scripted interleaving.

**Roadmap phase:** Phase 1 establishes invariants; Phase 2 persists them; Phase 4 requires adapter conformance tests.

### 3. Browser-local drafts are treated as durable or private by default

**What goes wrong:** `sessionStorage` disappears when its tab closes; `localStorage` persists across browser restart but is synchronous, origin-scoped, and temporary in private browsing. Browser storage is best-effort by default; quota failures throw; clearing site data can remove the whole origin; IndexedDB can be wiped, corrupted, or invalidated by incompatible changes. [MDN Web Storage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API) [MEDIUM] [MDN quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) [MEDIUM] [MDN IndexedDB limitations](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Basic_Terminology) [MEDIUM]

**Why it happens:** The browser is an attractive recovery location, but localhost port changes create a different origin and answers may contain secrets, repository details, or personal data.

**Consequences:** Silent draft loss in Incognito/private mode, freezing on synchronous writes, leaked answers to another local user profile/session, orphaned encrypted-looking but unusable data after schema changes, or a false “saved” toast when persistence failed.

**Prevention:** Make the Node-side local durable store authoritative; browser storage is only a best-effort cached replica for refresh/reconnect. Use a versioned, bounded draft envelope (`schemaVersion`, round capability hash, timestamps, checksum, payload) and atomic write/rename plus recovery from a previous valid record. Keep only the current/retained rounds, enforce size limits, and treat storage errors as visible state (`Draft could not be saved locally`) rather than a console warning. Explicitly disclose that drafts are stored on the local machine, offer opt-out/clear-now/retention controls, avoid logging content, and state that private mode cannot guarantee recovery. Maintain the fixed localhost origin/port policy where practical; otherwise browser cache recovery cannot span a port change.

**Detection / release evidence:** Automated tests inject quota, malformed JSON, partial file, checksum mismatch, permission error, and crash-before-rename failures. Browser acceptance covers refresh, accidental close, browser restart, private window, clearing site data, and restarting the Node process. Verify recovery copy never displays an unrelated round and the UI shows timestamp and retention expiry.

**Roadmap phase:** Phase 2, with browser privacy/help text finalized in Phase 5.

### 4. Draft corruption or recovery changes silently manufacture data

**What goes wrong:** A failed migration, partial JSON write, clock skew, or stale browser cache is accepted as a current draft. An implementation then fills missing fields with defaults and submits a syntactically valid but semantically altered answer set.

**Why it happens:** Settings already use atomic writes, but browser answer state is currently transient and opaque to the server. Adding persistence without a validation boundary forks the question/answer contract.

**Consequences:** Undetected answer loss, wrong ranking/tree choices, inability to explain recovery behavior, and unreproducible support cases.

**Prevention:** Persist an immutable question snapshot/hash alongside typed answer state; validate both against a single shared contract before rendering or delivery. Use a two-generation file format (active plus last-known-good), checksum/version every record, quarantine unreadable records, and offer an explicit “discard corrupt draft” action. Migration must be pure and idempotent (`vN → vN+1`), never mutate the only source in place, and must fail closed: retain the original and expose a recoverable error instead of guessing.

**Detection / release evidence:** Golden fixtures for every supported historical schema, property-style migration tests (repeat migration yields the same result), fault injection at every write step, and manual recovery from a copied old profile. Release notes must name any migration that cannot preserve drafts and provide a backup/export route first.

**Roadmap phase:** Phase 2; Phase 3 owns shared schema/migration machinery.

### 5. Settings become an unversioned collection of UI toggles

**What goes wrong:** Values are validated differently in the browser, CLI, installer, and server; an upgrade silently resets preferences; imports overwrite unrelated settings; old clients crash or reinterpret a value. This is particularly likely because the product has browser schema plus Node persistence and must retain Node 18 and zero runtime dependencies.

**Why it happens:** New controls (browser choice, close behavior, retention, lifecycle policy, host adapters) cut across layers, and environment variables are often applied after persisted settings without a documented precedence rule.

**Consequences:** “Works on my machine” configuration, launch regressions after upgrade, unsafe values such as remote bind/relaxed retention becoming possible, and support requests that cannot reproduce a user’s effective settings.

**Prevention:** Publish one JSON-compatible versioned settings document used by UI and Node validation. Define `schemaVersion`, defaults, type/range/enum validation, unknown-field policy, migration chain, and precedence (safe hard constraints > explicit CLI/env override > persisted user setting > default). Make import validate and preview before atomic replace; export redact secrets/paths as appropriate; reset creates a backup. Keep transport/security constraints non-configurable unless a separately approved threat-model change exists—`127.0.0.1` must not be a convenience toggle.

**Detection / release evidence:** Cross-layer contract tests run the same valid/invalid corpus through browser and Node validators. Test migration from every released schema, downgrade/unknown fields, interrupted import, concurrent writer lock, Windows/macOS/Linux config paths, and a fresh install with legacy config present. Add a `doctor` output that reports schema version and effective non-sensitive settings.

**Roadmap phase:** Phase 3, with packaging/doctor verification in Phase 5.

### 6. “MCP-compatible” is advertised as “AskUserQuestionsPro-compatible”

**What goes wrong:** A host can load an MCP server yet cannot safely support a long, interactive question round: it may impose a tool-call deadline, lack resumable request identity, require user approval on every invocation, run in a remote sandbox that cannot reach `127.0.0.1`, or apply enterprise allowlists. Current official docs already show material differences: Cursor supports stdio, SSE, and Streamable HTTP MCP transports; Cline supports MCP in extension and CLI contexts with its own permissions; Copilot CLI supports MCP but may be controlled by organization policy. [Cursor MCP](https://docs.cursor.com/context/model-context-protocol) [MEDIUM] [Cline MCP](https://docs.cline.bot/mcp/mcp-overview) [MEDIUM] [GitHub Copilot CLI MCP](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers) [MEDIUM]

**Why it happens:** Configuration resemblance and protocol branding are taken as proof of lifecycle compatibility. Marketing pages often omit tool-timeout, cancellation, project trust, remote execution, and installation behavior.

**Consequences:** Public claims fail for a substantial subset of users; support staff recommend unsafe workarounds; an adapter works only in one surface (IDE versus CLI) or one host version.

**Prevention:** Establish a capability contract before writing adapters: local process spawn/connection, localhost reachability, transport, invocation trigger, maximum tested wait, cancellation signal, stable correlation ID, user-approval behavior, config scope/trust, supported OS/version, install/remove/doctor path, and observed delivery result. Classify each host as `supported`, `experimental`, `blocked`, or `not researched`; only `supported` has a pinned version, official source, automated contract test, and manual acceptance recording. “MCP loadable but long-round guarantee unproven” is experimental—not supported.

**Detection / release evidence:** A machine-readable compatibility matrix is generated from adapter metadata and test evidence. CI must fail if documentation claims `supported` without a dated evidence artifact. Test every supported host in both a fresh-profile install and an existing-profile upgrade; test project trust and organization-policy denial where applicable. Codex project-local configuration and hooks are ignored for untrusted projects, so trust state belongs explicitly in the matrix. [Codex manual](https://developers.openai.com/codex/codex-manual.md) [MEDIUM]

**Roadmap phase:** Phase 4; Phase 5 publishes only the resulting status.

### 7. Hook, MCP, extension, and CLI adapters share code but not lifecycle semantics

**What goes wrong:** A generic adapter assumes every integration can block for a response. Claude’s native hook path, a stdio MCP tool, an IDE extension callback, and a headless CLI command have different process ownership, stdin/stdout framing, approval, and cancellation mechanisms. Host configuration can also be scoped or trust-gated. For example, Codex loads project hooks/config only for trusted projects; Claude MCP configuration has local/project/user scopes; Copilot CLI can require organization enablement. [Codex manual](https://developers.openai.com/codex/codex-manual.md) [MEDIUM] [Claude Code MCP](https://docs.anthropic.com/en/docs/claude-code/mcp) [MEDIUM] [GitHub Copilot CLI overview](https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli/overview) [MEDIUM]

**Why it happens:** Reusing `bridge-client.mjs` is good, but embedding host policy in that shared client blurs which layer owns cancellation, fallback, and formatting.

**Consequences:** Deadlocks from stdout contamination, host fallback disabled accidentally, wrong exit code, detached child processes, repeated browser opens, and adapter regressions when adding a new host.

**Prevention:** Keep the bridge transport contract host-neutral, but give each adapter an explicit policy object: invocation shape, response framing, cancellation mapping, deadline source, retry/resume affordance, fallback behavior, supported configuration scopes, and diagnostics command. Do not auto-install hooks/config into a project without consent. Make adapters fail safely: pass through or give a clear unsupported instruction rather than claiming delivery. Preserve JSON-RPC/stdout purity for MCP and stderr-only diagnostics.

**Detection / release evidence:** Spawn each adapter as its real host would: closed stdin, delayed stdout consumer, SIGTERM/SIGINT, parent death, invalid configuration, untrusted project, Windows command path, and repeated invocation. Assert exit code, valid wire payload, no secret/answer output, and one browser-open decision. Manual evidence must use the installed host—not a hand-written MCP test client alone.

**Roadmap phase:** Phase 4.

### 8. Installer convenience erodes local trust or breaks existing configuration

**What goes wrong:** Shell installers overwrite host settings, install an adapter at the wrong scope, run unreviewed lifecycle scripts, or leave a partial install after failure. The user is asked to trust a local server that can receive sensitive answers, so opaque `curl | sh` and broad config rewrites are especially damaging. npm confirms global installs run package lifecycle scripts; provenance provides an auditable source/build link but is not proof that code is benign. [npm scripts](https://docs.npmjs.com/cli/using-npm/scripts/) [MEDIUM] [npm provenance](https://docs.npmjs.com/generating-provenance-statements/) [MEDIUM]

**Why it happens:** Supporting many hosts multiplies config locations, ownership rules, shell quoting differences, and upgrade/uninstall paths.

**Consequences:** Lost user config, an adapter that starts in an unexpected project, supply-chain concern at Product Hunt launch, broken uninstall, or host refusal because an enterprise policy blocks the new configuration.

**Prevention:** Default to `npm` package installation with pinned/reproducible release artifacts, provenance-enabled publishing, checksums/release notes, and a dry-run `doctor`. Installer operations must be narrow, idempotent, and reversible: parse/merge only the named AskUserQuestionsPro entry, create timestamped backup, state exact file/scope changed, and provide matching uninstall. Never execute downloaded host-specific scripts during normal install. Respect host/project trust and policy; report “admin policy blocks installation” instead of circumventing it.

**Detection / release evidence:** Fresh install, upgrade, uninstall, and failed-mid-install tests in disposable profiles for macOS/Linux/Windows. Snapshot unrelated host config before/after. Verify published tarball contents, `npm pack`, package provenance/signatures where supported, and `doctor` on all claimed host targets.

**Roadmap phase:** Phase 4 builds installer adapters; Phase 5 owns release packaging evidence.

## Moderate Pitfalls

### Browser close happens on submission rather than confirmed delivery

**What goes wrong:** The UI closes or shows final success when the browser has sent an answer request, while the host result has not been accepted or the process has already died.

**Prevention:** Show `Submitting`, then `Awaiting host confirmation`, then `Delivered`; only close automatically after a durable delivery acknowledgement and a user-configurable grace period. If acknowledgement is impossible, preserve the tab and present a resume/copy-result path. Do not claim exactly-once delivery across a host crash; claim at-least-once recovery with a visible state.

**Roadmap phase:** Phase 1 contract, Phase 5 lifecycle UX acceptance.

### Localhost origin drift makes browser recovery appear random

**What goes wrong:** Dynamic ports, HTTP/HTTPS changes, or opening a different browser profile create a different browser origin/profile, so a cache-backed draft cannot be found.

**Prevention:** Identify server instance and origin in the persisted round record; prefer a stable localhost origin/port when recovery is enabled, and rely on the Node durable store when it is not. Test configured browser selection/profile and a server restart that chooses a different port.

**Roadmap phase:** Phase 2 and Phase 5.

### Retention is either infinite or too short to be useful

**What goes wrong:** Infinite retention exposes sensitive answers; a short TTL silently deletes work while a host deadline still makes resume necessary.

**Prevention:** Set a conservative default TTL, display expiry and cleanup result, permit user-controlled bounded retention, securely delete/overwrite where platform semantics allow, and separate terminal audit metadata from answer payload retention. Never include answer content in diagnostic telemetry.

**Roadmap phase:** Phase 2, settings surfaced in Phase 3.

### Accessibility and recovery state diverge

**What goes wrong:** A restored draft has selected visual controls but missing keyboard/ARIA announcement, focus lands in a closed modal, or an error banner is not announced.

**Prevention:** Treat recovery, submitting, delivery pending, conflict, and expired as first-class UI states with focus-management and live-region tests. Preserve current typed-question semantics when restoring.

**Roadmap phase:** Phase 5.

## Minor Pitfalls

### Diagnostics leak prompts or answers

**What goes wrong:** The new lifecycle telemetry is useful but logs question/answer payloads or local file paths into host stderr, bug reports, or screenshots.

**Prevention:** Log only opaque IDs, state transitions, durations, capability flags, and redacted error classes by default. Require explicit local opt-in for content-bearing diagnostics and make export scrub payloads.

**Roadmap phase:** Phase 1.

### Tests depend on wall-clock sleeps

**What goes wrong:** Long-round regression coverage becomes slow/flaky and is disabled before launch.

**Prevention:** Inject clocks/deadline schedulers, use deterministic fake timers for state transitions, reserve a small number of real delayed host acceptance tests, and record duration/host version in the artifact.

**Roadmap phase:** Phase 1 and Phase 4.

## Phase-Specific Warnings

| Phase topic | Likely pitfall | Observable mitigation / exit criterion |
|---|---|---|
| 1. Lifecycle contract | Ambiguous terminal states and no proof of timeout owner | State-transition table, redacted correlation events, and race test matrix pass; real Codex/Claude run identifies the responsible deadline. |
| 2. Draft durability | Browser cache mistaken for durable storage; corrupt record is accepted | Node authoritative two-generation record, shared contract validation, fault-injection tests, and recovery UX for refresh/process restart/private mode. |
| 3. Settings | Silent reset/import overwrite or divergent browser/server validation | Versioned schema, migration fixture suite, precedence document, atomic import/export/reset, and `doctor` reports effective non-sensitive values. |
| 4. Host adapters | “MCP supported” becomes an unverified compatibility claim | Capability matrix includes installed host version, official source, config scope, deadline/cancel results, automated contract run, and manual acceptance recording. |
| 5. Launch hardening | Success UI/auto-close hides undelivered work; installer breaks user setup | Delivery-confirmation UI test, accessibility pass, fresh/upgrade/uninstall package tests, and published compatibility/unsupported status page. |

## Explicit Out-of-Scope / Do-Not-Do Decisions

- Do not solve host timeouts by exposing the unauthenticated bridge beyond `127.0.0.1`, adding a remote relay, or moving answers to a cloud database; that changes the product threat model.
- Do not market any host as supported solely because it reads an MCP config or can list the tool.
- Do not retain drafts indefinitely, silently persist them in private browsing, or imply browser storage is a backup guarantee.
- Do not auto-edit broad host settings, bypass project trust/enterprise policy, or recommend unsafe approval flags just to make an adapter work.
- Do not auto-close a browser tab merely after `/answer` returns; completion means durable host-delivery acknowledgement or a clearly displayed recoverable non-delivery state.

## Sources

- [Model Context Protocol — Cancellation](https://modelcontextprotocol.io/specification/latest/basic/utilities/cancellation) — MEDIUM (official protocol; cancellation race semantics).
- [OpenAI Codex Manual](https://developers.openai.com/codex/codex-manual.md) — MEDIUM (official, freshly fetched; MCP timeout defaults, project trust, hooks/configuration).
- [MDN Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API), [storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria), and [IndexedDB terminology/limitations](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Basic_Terminology) — MEDIUM (browser platform behavior).
- [Claude Code MCP](https://docs.anthropic.com/en/docs/claude-code/mcp) and [Claude Code CLI reference](https://docs.anthropic.com/en/docs/claude-code/cli-usage) — MEDIUM (official host configuration evidence; exact hook deadline requires local verification).
- [Cursor MCP](https://docs.cursor.com/context/model-context-protocol), [Cline MCP](https://docs.cline.bot/mcp/mcp-overview), and [GitHub Copilot CLI MCP](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers) — MEDIUM (official current integration surfaces; not proof of long-round lifecycle support).
- [npm lifecycle scripts](https://docs.npmjs.com/cli/using-npm/scripts/) and [npm provenance](https://docs.npmjs.com/generating-provenance-statements/) — MEDIUM (installer trust and release evidence).

## Research Gaps Requiring Phase-Specific Work

- Establish the observed timeout/cancel/resume semantics for every claimed version of Claude Code and Codex through authenticated, installed-host acceptance runs; documentation alone does not establish the original five-minute failure source.
- Investigate each candidate host individually (OpenCode, Roo Code, Windsurf, Gemini CLI, Aider, Amazon Q Developer, Kiro, Qwen Code, Kilo Code, and newly discovered hosts). No compatibility status should be inferred from protocol similarity.
- Decide whether durable payloads live only in the Node profile directory or are additionally browser-cached; this needs a threat-model and recovery UX decision before implementation.
