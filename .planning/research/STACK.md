# Technology Stack and Host Ecosystem

**Project:** AskUserQuestionsPro v1.1 Sprint 2  
**Researched:** 2026-07-17  
**Scope:** Durable local recovery, versioned settings, lifecycle delivery, and safe host adapters.  
**Overall confidence:** MEDIUM — primary vendor documentation was checked for the central protocol and named hosts; actual install/recovery acceptance remains required per host/version.

## Decision Summary

Keep the current Node.js `>=18`, raw `node:http`, vendored React/Babel, and zero-production-dependency distribution. Add **no runtime package**. Make the local bridge's on-disk journal the authority for drafts and delivery state; use browser IndexedDB only as a second, best-effort cache. Model the host layer as capability adapters around one stable local HTTP contract, with MCP as the common tool-invocation route and Claude's native hook as the sole special path.

Do not attempt to solve host tool deadlines by changing one timeout. MCP standardizes initialization, calls, cancellation notifications, and transports, but it does **not** give a portable guarantee that a host will wait indefinitely for a human answer. A submitted round therefore becomes *delivery-pending* until the originating adapter has acknowledged the answer (or the host connection is known to have received it); a host deadline leaves a recoverable round on disk rather than deleting work.

## Recommended Stack

### Core and durability

| Technology | Version/status | Purpose | Recommendation and compatibility impact |
|---|---:|---|---|
| Node.js built-in `node:fs`, `node:path`, `node:crypto` | Node `>=18` (existing) | Durable draft/delivery journal, IDs, retention cleanup | **Use; no dependency.** Persist an envelope `{formatVersion, round, drafts, delivery, timestamps}` with write-temp → `fsync` → atomic `rename`, reusing and strengthening the existing atomic-write chokepoint. Node documents `fsync` and `rename`; validate crash recovery on macOS, Linux, and Windows. Keep files user-readable only (`0o600` where supported). |
| JSON files, one round per file plus compact index | New internal format v1 | Recover after browser/host/server restart | **Use instead of SQLite or a third-party store.** It fits single-user/single-flight scope, permits corrupt-file quarantine, avoids a migration dependency, and makes retention inspectable. Do not overwrite the only valid copy; keep a bounded previous generation until the new file is readable and schema-valid. |
| Shared `settings-schema.js` plus migration registry | New public schema v1 | Settings validation, defaults, import/export, migration | **Use; no JSON-schema package.** Create pure `parseSettings`, `migrateSettings`, `serializeSettings`, and `formatVersion` functions shared by browser and Node. Migrations must be ordered, idempotent, and tested from every supported fixture; unknown future versions fail safely with export/recovery guidance rather than silently resetting settings. |
| IndexedDB | Web platform, broadly available | Browser-local draft mirror | **Use as a cache, not authority.** Store drafts keyed by durable `roundId`/origin and debounce writes after every input. On reconnect/refresh, reconcile by monotonically increasing revision and server acknowledgement. It protects the narrow interval before a POST reaches the bridge, but browser storage can be cleared and cannot establish end-to-end delivery. |
| Page Visibility API + `visibilitychange`; optional `pagehide` / `sendBeacon` | Web platform, broadly available | Opportunistic flush on backgrounding | **Use opportunistically only.** Flush IndexedDB and attempt a small checkpoint when hidden; never rely on `beforeunload` or a forced tab close for correctness. The bridge must already hold a committed draft before a page can safely disappear. |
| Raw `node:http` + SSE | Existing | Local API, live state and reconnect | **Keep.** Add idempotent checkpoint, round lookup/recovery, and delivery-ack endpoints; protect every mutation with round ID, revision, and terminal-state checks. Preserve `127.0.0.1` binding. Explicitly set and test server timeouts: Node 18's default `requestTimeout` is 300,000 ms, although it concerns receiving a request body—not a human round. |
| Native `node:test`, ESLint, Prettier | Existing | Regression/contract verification | **Keep.** Add filesystem crash/restart, migration-fixture, concurrent-write, stale-tab, and delivery-state tests. Add a host acceptance matrix, not a new test framework. |

### MCP and adapter boundary

| Technology | Version/status | Purpose | Recommendation and compatibility impact |
|---|---:|---|---|
| Model Context Protocol (MCP) | Current spec documented as `2025-11-25` | Portable host-facing tool surface | **Use tools over existing stdio MCP server as the compatibility baseline.** Announce only `tools` unless another capability is genuinely required. Preserve newline-delimited JSON-RPC stdout discipline; log exclusively to stderr. Negotiate protocol version during `initialize`; never infer support from a similar config shape. |
| MCP stdio transport | Current standard transport | Local subprocess integration | **Primary host transport.** It is the widest common denominator and preserves the package's local-only architecture. Ship one stable executable/command with Node 18 compatibility; adapters only generate host configuration and diagnostics. |
| MCP Streamable HTTP | Current MCP transport | Optional future local/remote-compatible integration | **Do not add in Sprint 2 unless a selected host needs it.** If exposed locally, bind loopback, validate `Origin` to prevent DNS rebinding, and avoid unauthenticated non-loopback operation. It increases attack surface with no benefit for the broadest local integration path. |
| Host capability manifest | New project JSON/JS contract | Declare install/config/test/lifecycle properties | **Add.** Each adapter must declare: host/version tested, transport, config scopes/files, installation mechanism, tool approval behavior, timeout knobs/known deadline, cancellation signal, resume semantics, cleanup policy, and evidence URLs. A host becomes “supported” only when all required fields and a manual recovery/delivery run pass. |
| Claude Code native hook | Current host-specific integration | Intercept native `AskUserQuestion` path | **Retain as a dedicated adapter, not a generic MCP substitute.** Claude supports command/HTTP/MCP-tool hooks across lifecycle events and plugin packaging. The hook must fail open to Claude's native experience on bridge failure and must not claim the host controls an indefinite wait. |

### Deliberately not added

| Candidate | Why not |
|---|---|
| SQLite, LevelDB, ORM, or hosted database | A single-user local journal is sufficient, preserves zero dependencies, and avoids native/prebuilt packaging and migration surface. Re-evaluate only if concurrent multi-round or cross-process querying becomes a product requirement. |
| Express/Fastify, React build pipeline, service worker | They do not solve durability or host deadlines and conflict with the established small, vendored distribution model. |
| A generic hook framework | Hook payloads, permissions, cancellation, and policy differ by host; normalize only the product adapter contract, not the host's lifecycle protocol. |
| Remote/MCP HTTP server as default | It contradicts localhost-only safety and would require authentication, Origin, and deployment lifecycle design. |

## Durable Lifecycle Contract

Implement this bridge-owned state machine; adapters translate host events but must not own user work:

```text
created → active ↔ detached → submitted → delivery-pending → delivered → terminal
                    ↓              ↓              ↓
                 cancelled      retryable       recovery-required
```

- `active` is durable as soon as validated questions and a round ID are journaled.
- Every browser edit is revisioned; the server acknowledges a committed revision. Browser cache replay never overwrites a newer server revision.
- `submitted` means answers are complete and frozen as a candidate payload—not that the host received them.
- `delivery-pending` retains the payload and delivery receipt metadata while the original request is still connectable or an adapter retry route exists.
- `delivered` requires an adapter-visible acknowledgement: at minimum the response write completed without a destroyed connection; where the host does not expose an acknowledgement, label this “transport delivered,” retain for a grace period, and say so in UI/docs.
- A host cancellation/deadline is not implicit discard. Record reason, host request correlation ID, and next recovery action; explicit user cancellation is terminal and separately confirmed.
- Tab close is a *post-delivery UX action*: request it only after durable delivery state and grace-period policy. Browsers may refuse scripted close for tabs not opened by script, so offer “Done—safe to close” as the normative behavior.

## Settings System Contract

Use one canonical settings document:

```json
{
  "formatVersion": 1,
  "updatedAt": "2026-07-17T00:00:00.000Z",
  "settings": { "recovery": {}, "lifecycle": {}, "browser": {}, "accessibility": {} }
}
```

Rules:

1. Validate untrusted UI/import data before merging; preserve neither unknown executable fields nor environment/command settings through import.
2. Keep runtime overrides (environment and CLI) separate from persisted user settings and document precedence: defaults → migrated file → host-safe user settings → CLI/env override.
3. Export the versioned document plus non-sensitive metadata. Import creates a timestamped backup, validates/migrates in memory, atomically commits, then returns field-level diagnostics.
4. Retention, post-submit close behavior, browser opener preference, reconnect display, and accessibility preferences belong in settings. Host transport/command paths remain adapter-owned install data rather than browser-editable arbitrary execution settings.

## Host Ecosystem: Evidence-Based Support Tiers

“MCP-compatible” only means a host can discover/call the MCP tool. It does not prove long-round survival, timeout ownership, automatic installation, or post-submit acknowledgement. The following statuses are research priorities, not launch claims.

| Host | Officially documented surface | Recommended route | Tier / required evidence |
|---|---|---|---|
| Claude Code | Native hooks; MCP; plugin packages; user/project/managed scopes | Existing native hook for `AskUserQuestion`; package MCP/skills where useful | **Tier 1.** Test hook wait/disconnect/fallback separately from MCP. Managed policy can prohibit hooks; plugin data path, not plugin root, is durable. |
| OpenAI Codex / ChatGPT Desktop | MCP stdio and Streamable HTTP; config includes startup/tool timeout fields | Existing stdio MCP adapter | **Tier 1.** Exercise actual Codex/desktop deadline and reconnect against a 15-question idle round; do not turn a configured host tool timeout into data loss. |
| Cursor | MCP stdio, SSE, Streamable HTTP; `.cursor/mcp.json` and `~/.cursor/mcp.json`; extension API | Stdio config first; optional project config generator | **Tier 2.** Tool support is documented. Verify user approval, Cursor Agent CLI, and the behavior when a tool call waits for browser recovery. |
| Cline / Roo Code family | Cline documents MCP for VS Code and CLI with `mcp.json`; current CLI also documents hooks/plugins/ACP | Stdio MCP; do not rely on Cline interaction tools as a product adapter | **Tier 2 for Cline, research Roo independently.** Confirm Roo's own maintained docs/config and host deadline before claiming parity. |
| Windsurf | Documents MCP in Cascade | Manual stdio MCP configuration only until exact config schema is re-verified | **Research candidate.** Current documentation proves MCP availability but the searched official material did not establish durable tool-wait/install semantics. |
| GitHub Copilot CLI | `/mcp` and `copilot mcp`; local and HTTP definitions; user/workspace/plugin sources and organization allowlists | Stdio MCP with `copilot mcp` installer/doctor support | **Tier 2.** Verify interactive approval and enterprise registry policy. GitHub documents an experimental server search, not a reason to depend on registry publication. |
| Gemini CLI | `settings.json` `mcpServers`; stdio/SSE/Streamable HTTP; discovery/execution timeout handling | Stdio MCP | **Tier 2.** Verify exact current settings scope and a recovery acceptance run; treat host connection-state handling as host-owned. |
| Amazon Q Developer | CLI and IDE support local-process and HTTP MCP; global and IDE config; organization governance | Stdio MCP plus documented manual/CLI config | **Tier 2.** Test with MCP governance off/allowlist on. Background loading and configurable initialization timeout mean readiness must be diagnosed, not assumed. |
| Kiro | IDE/CLI MCP configuration, server directory, URL install links, enterprise allowlists | Stdio MCP; optionally publish a generated one-click Kiro link after manual validation | **Tier 2.** Install link is packaging convenience, not lifecycle proof; enterprise clients fail closed when governance is unavailable. |
| Qwen Code | `qwen mcp`; `settings.json`; user/project scope; stdio/HTTP and OAuth docs | Stdio MCP | **Tier 2.** Its docs warn OAuth tokens may be unencrypted by default; AskUserQuestionsPro should require no token and must not write host credentials. |
| Kilo Code | Global/project MCP configuration, permissions, CLI `kilo mcp` | Stdio MCP | **Tier 2.** Docs say MCP tool operations cannot run simultaneously; test serial delivery/recovery and approval. |
| OpenCode | Official docs list MCP servers and custom tools | Stdio MCP once the current configuration reference is exercised | **Research candidate.** Treat its custom-tool API as materially different from MCP; do not add custom-tool integration unless MCP acceptance fails and product value justifies a separate adapter. |
| Aider | No current official MCP/extension contract was established in this research pass | No support claim | **Unsupported pending authoritative surface.** Aider's CLI workflow/protocol resemblance is not evidence of a safe bridge integration. |
| Other IDE agents | Varies; some expose VS Code extension APIs, ACP, or proprietary workflows | Start from the MCP adapter manifest | **Unverified.** A different extension mechanism is a separate adapter project, not automatic compatibility. |

## Packaging and Installation Requirements

- Keep `npm` package and shell installer as the source of truth. Add `doctor` checks that detect the host executable, print selected config scope/path, validate the command exists, and run an MCP health/round-recovery probe without changing unrelated configuration.
- Prefer additive, named MCP config entries and idempotent edits. Back up a host config before mutation; never overwrite whole JSON/TOML documents or add credentials.
- Split distribution from configuration: package the same Node executable everywhere; each host adapter owns a narrowly tested config writer, uninstaller, status probe, and manual verification script.
- Do not package host-specific extension binaries in Sprint 2. Claude plugins are an optional distribution channel because Claude documents them; Cursor extensions, proprietary marketplaces, and one-click links should follow only after that host's acceptance tests and release process are documented.
- Documentation must state exact tested host version/date, configuration scope, transport, permissions prompt, known deadline, recovery instruction, uninstall command, and unsupported rationale.

## Phase Research and Verification Gates

1. **Durable journal and state machine first.** Test process kill between draft revisions, corrupt/partial files, restart, revision conflict, explicit cancel, retention cleanup, and no answer payload in lifecycle logs.
2. **Settings v1 and migration/import next.** Add fixtures for invalid, prior, future, interrupted-write, and import rollback; make browser/Node validate exactly the same values.
3. **Browser recovery/delivery UX after persistence.** Test refresh/offline/reconnect, delivery-pending visibility, screen-reader announcements, and user-initiated versus denied tab close.
4. **Adapter contract and Tier 1 host acceptance.** Record real Claude and Codex tool/hook evidence including 15-question idle rounds, host disconnect, recover/retry, and delivery receipt.
5. **Tier 2 hosts one at a time.** Each needs a documented install/doctor path and the same manual lifecycle matrix; otherwise publish “research candidate” or “unsupported,” never a compatibility badge.

## Sources and Confidence

All central claims are cross-checked against current primary documentation where available; **MEDIUM** reflects the unavoidable need to execute versions in local host installations.

- **MCP — MEDIUM:** [specification repository](https://github.com/modelcontextprotocol/modelcontextprotocol), [2025-11-25 transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports), and [lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle).
- **Node/browser — MEDIUM:** [Node 18 HTTP timeouts](https://nodejs.org/download/release/v18.9.0/docs/api/http.html), [Node filesystem API](https://nodejs.org/api/fs.html), and [MDN Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API).
- **Claude — MEDIUM:** [hooks](https://code.claude.com/docs/en/hooks), [MCP](https://code.claude.com/docs/en/mcp), [plugins](https://code.claude.com/docs/en/plugins), and [configuration/policy](https://code.claude.com/docs/en/configuration).
- **Codex — MEDIUM:** [Codex repository MCP config types](https://github.com/openai/codex/blob/main/codex-rs/config/src/mcp_types.rs) and [CLI MCP management](https://github.com/openai/codex/blob/main/codex-rs/cli/src/mcp_cmd.rs). Version-specific acceptance remains required because Codex evolves rapidly.
- **Documented MCP hosts — MEDIUM:** [Cursor](https://docs.cursor.com/context/model-context-protocol), [Cline](https://docs.cline.bot/mcp/mcp-overview), [GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers), [Gemini CLI](https://geminicli.com/docs/tools/mcp-server/), [Amazon Q Developer](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/qdev-mcp.html), [Kiro](https://kiro.dev/docs/cli/mcp/configuration/), [Qwen Code](https://qwenlm.github.io/qwen-code-docs/en/users/features/mcp/), [Kilo Code](https://kilo.ai/docs/automate/mcp/using-in-kilo-code), and [OpenCode](https://opencode.ai/docs/tools/).

## Gaps Requiring Phase-Specific Research

- Host version numbers, tool default deadlines, cancellation delivery, and “response written” semantics are not portable MCP guarantees; collect them in tested adapter evidence rather than hard-coding assumptions.
- Verify the exact latest official Roo Code and Windsurf configuration references before implementation; available evidence here proves MCP presence but not the complete safe installation/lifecycle contract.
- Browser storage quotas/eviction and OS-level power loss require manual platform checks. The product guarantee should be phrased as recovery within a documented retention window after a successfully committed local checkpoint, not as absolute protection from every hardware/filesystem failure.
- Aider and any host without an authoritative tool-extension surface remain explicitly unsupported until such a surface and end-to-end test exist.
