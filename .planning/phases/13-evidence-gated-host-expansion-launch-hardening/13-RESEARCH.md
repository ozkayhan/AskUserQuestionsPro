# Phase 13: Evidence-Gated Host Expansion & Launch Hardening - Research

**Researched:** 2026-07-17
**Domain:** Multi-host MCP adapter evidence, cross-platform release verification, and support documentation
**Confidence:** MEDIUM

## Summary

Phase 12 leaves a strong local foundation: the bridge contract, fake-host conformance, redaction checks, scoped Claude/Codex installer tests, and a dated Tier 1 matrix are present. [VERIFIED: codebase grep] The authenticated Claude Code and Codex rows remain unavailable, so Phase 13 must preserve the same distinction between local protocol evidence and installed/authenticated host evidence. [VERIFIED: `.planning/phases/12-adapter-contract-tier-1-acceptance/12-VERIFICATION.md`]

Official documentation shows that most Phase 13 candidates expose an MCP configuration surface, commonly local stdio plus one or more HTTP/SSE transports. [CITED: https://docs.cursor.com/context/model-context-protocol] [CITED: https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers] [CITED: https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md] This is an integration hypothesis only: MCP tool discovery does not prove long-round behavior, host deadlines, cancellation semantics, approval policy, install scope, or delivery acknowledgement.

**Primary recommendation:** Split implementation into (1) a machine-readable evidence ledger and capability-card/matrix documentation for all named hosts, (2) only the adapters that pass official-doc review plus installed-host conformance, and (3) an independent macOS/Linux/Windows launch-hardening and clean-release gate.

## Phase Requirements

| ID | Description | Research Support |
|---|---|---|
| HST-02 | Evaluate Cursor, GitHub Copilot CLI, Gemini CLI, Amazon Q Developer | Official MCP/configuration surfaces are documented below; no candidate is live-accepted locally. |
| HST-03 | Evaluate Cline, Kiro, Kilo Code, Qwen Code, OpenCode | Official MCP/configuration evidence exists for Cline, Kiro, Qwen Code, and OpenCode; Kilo Code still requires an authoritative source and installed run. |
| HST-04 | Research Roo Code and Windsurf individually; keep Aider unsupported absent safe proof | Individual configuration surfaces are recorded; no support promotion is justified. |
| HST-05 | Publish machine-readable and user-facing compatibility matrix | Use one redacted evidence schema shared by cards, tests, and docs. |
| HST-06 | Explain unsupported hosts clearly | Status must be derived from evidence state, never MCP discoverability alone. |
| QLT-01 | Verify durable recovery on macOS, Linux, Windows | Requires OS matrix with clean homes, permissions, restart/corruption/retention scenarios. |
| QLT-02 | Run clean-checkout quality and release gates | Existing commands and missing local tooling are identified below. |
| QLT-03 | Cover install/upgrade/uninstall/trust/config scope for claimed hosts | Requires installed-host runs and isolated configuration snapshots per host. |
| DOC-06 | Maintain recovery/settings/timeout/delivery/troubleshooting docs | Existing `docs/hosts.md` and `docs/testing.md` are the primary seams. |
| DOC-07 | Capability card for every supported/unsupported host | Generate cards from the same evidence vocabulary as the matrix. |
| DOC-08 | Document redacted diagnostics and local privacy/retention | Preserve opaque IDs and lifecycle metadata only; never record question/answer content. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Host transport/framing | API / Backend | Host adapter | The existing MCP server and hook own protocol framing; host-specific adapters must preserve it. [VERIFIED: codebase grep] |
| Host registration and configuration | API / Backend | Host installation scope | Installer/doctor mutate host-owned config; each host needs an isolated scope test. [VERIFIED: `bin/cli.js`, Phase 12 plans] |
| Round lifecycle and recovery | API / Backend | Database / Storage | `server/bridge.js` and durable round records remain authoritative; hosts only attach/detach/result-deliver. [VERIFIED: `ARCHITECTURE.md`, codebase grep] |
| User answers and reconciliation | Browser / Client | API / Backend | Browser state is transient; server snapshots are authoritative. [VERIFIED: `ARCHITECTURE.md`] |
| Compatibility claims | API / Backend | Documentation | Evidence ledger and cards must distinguish protocol, fake-host, installed, and authenticated evidence. |
| Cross-platform release proof | Database / Storage | CDN / Static | Filesystem durability, permissions, packaging, and installer behavior vary by OS. |

## User Constraints

- Preserve Claude Code and Codex integrations.
- Support Node.js 18+ and existing supported host platforms.
- Preserve zero production dependencies and the current distribution contract.
- Keep the bridge bound to `127.0.0.1`; do not expand the threat model.
- Every reliability change needs automated regression coverage and boundary verification.
- Preserve historical rationale while removing stale duplication. [VERIFIED: `AGENTS.md` project context]

## Standard Stack

### Core

| Component | Version/status | Purpose | Why standard |
|---|---|---|---|
| Node.js built-ins and `node:test` | Node `>=18`; local Node `v26.0.0` | Bridge, adapters, tests, subprocess evidence | Existing zero-production-dependency architecture and native test runner. [VERIFIED: `package.json`, local command] |
| MCP stdio | Protocol surface; host-specific behavior unverified | Primary candidate transport for local bridge integration | Official docs expose stdio configuration for Cursor, Copilot CLI, Gemini, Amazon Q, Kiro, Qwen Code, OpenCode, and Roo. [CITED: https://docs.cursor.com/context/model-context-protocol] [CITED: https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers] [CITED: https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md] |
| Markdown + JSON evidence ledger | New phase artifact | Human matrix and machine assertions | Matches existing docs/tests and introduces no runtime dependency. [VERIFIED: codebase grep] |

### Supporting

| Component | Version/status | Purpose | When to use |
|---|---|---|---|
| `npm ci`, `npm test`, `npm pack --dry-run` | Existing scripts | Clean-checkout/release verification | Every release candidate. [VERIFIED: `package.json`, `docs/testing.md`] |
| `shellcheck`, `bash -n` | `shellcheck` available locally | Installer verification | Shell changes and cross-platform shell packaging checks. [VERIFIED: local command] |
| Isolated HOME/config roots | Existing test pattern | Prevent host config leakage | Every install/upgrade/uninstall evidence run. [VERIFIED: Phase 12 plans and `test/helpers/isolation.js`] |

**Installation:** No new production package is recommended. Candidate hosts must be installed manually in a dedicated verification environment by the maintainer; this research did not install any host.

## Candidate Host Evidence and Implications

| Host | Official evidence dated 2026-07-17 | Transport/config implication | Honest local status |
|---|---|---|---|
| Cursor | Official docs describe stdio, SSE, and Streamable HTTP; project config `.cursor/mcp.json` and global `~/.cursor/mcp.json`. [CITED: https://docs.cursor.com/context/model-context-protocol] | Likely manual or narrowly scoped JSON registration; verify CLI vs IDE behavior and Windows/macOS/Linux path handling. | `Researching`; executable absent locally. |
| GitHub Copilot CLI | Official docs provide `/mcp add`, `copilot mcp add`, local/stdio and HTTP/SSE, and user config `~/.copilot/mcp-config.json`; org allowlists may restrict servers. [CITED: https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers] | Registration must respect enterprise allowlists and approval/tool selection; verify CLI version and authenticated session. | `Researching`; executable absent locally. |
| Gemini CLI | Official docs describe stdio/SSE/HTTP, `mcpServers`, user `~/.gemini/settings.json`, project scope, `gemini mcp add/remove`, trust behavior, and environment sanitization. [CITED: https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md] | Must test trusted vs untrusted workspace, tool approval, config precedence, and explicit environment passing; do not leak secrets. | `Researching`; executable absent locally. |
| Amazon Q Developer | Official docs describe local MCP processes, HTTP, global `~/.aws/amazonq/cli-agents`, and CLI/IDE config scopes; initialization timeout is configurable. [CITED: https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/qdev-mcp.html] | CLI and IDE may have different config paths; test `q settings mcp.initTimeout`, approval/governance restrictions, and local stdio process behavior. | `Researching`; executable absent locally. |
| Cline | Official docs describe MCP and a `cline mcp` command; the CLI also exposes hook, doctor, and plugin surfaces. [CITED: https://docs.cline.bot/mcp/mcp-overview] [CITED: https://docs.cline.bot/cli/cli-reference] | Determine whether the relevant product is the VS Code extension or CLI, then verify config scope and whether hooks can safely carry this adapter. | `Researching`; executable absent locally. |
| Kiro | Official docs describe MCP config, global/workspace scopes, `kiro-cli mcp add/remove/list`, and enterprise allowlists. [CITED: https://kiro.dev/docs/cli/mcp/configuration/] [CITED: https://kiro.dev/docs/enterprise/governance/mcp/] | Test workspace vs global mutations, governance fail-closed behavior, and whether Kiro IDE and `kiro-cli` are separate adapters. | `Researching`; executable absent locally. |
| Kilo Code | No authoritative official page was obtained in this session. | Do not design an installer or claim transport until official docs and an installed product identify the integration surface. | `Researching` only; no support claim. |
| Qwen Code | Official repository docs describe `mcpServers` with stdio `command`, SSE `url`, Streamable HTTP `httpUrl`, timeout, trust, allow/deny, and environment fields. [CITED: https://github.com/QwenLM/qwen-code/blob/main/docs/users/configuration/settings.md] | Verify repository/version provenance, config scope, approval/trust behavior, and install/update commands before any adapter work. | `Researching`; executable absent locally. |
| OpenCode | Official docs describe custom tools/MCP and current CLI support for `opencode mcp add`; local binary `1.15.12` exists, but no authenticated or conformance run was performed. [CITED: https://opencode.ai/docs/tools/] [CITED: https://dev.opencode.ai/docs/cli/] | Highest-priority local candidate for a manual gate, but do not treat binary presence or MCP discoverability as support. Capture config scope, timeout, cancellation, and approval behavior. | `Researching`; installed but untested. |
| Roo Code | Official docs describe global `mcp_settings.json`, project `.roo/mcp.json`, stdio JSON, and project-over-global precedence. [CITED: https://roocodeinc.github.io/Roo-Code/features/mcp/using-mcp-in-roo/] | Likely VS Code extension-specific; verify extension version, workspace trust, config mutation, and whether the extension can preserve long-running stdio calls. | `Researching`; executable absent locally. |
| Windsurf | Official vendor documentation was not obtained directly in this session; a third-party Cloudflare setup references `~/.codeium/windsurf/mcp_config.json`, which is insufficient for authoritative product claims. [CITED: https://developers.cloudflare.com/agent-setup/windsurf/] | Require direct Windsurf documentation and installed manual verification before choosing config paths or transport claims. | `Researching`; no support claim. |
| Aider | Official docs establish Aider as a terminal pair-programming tool, but this session did not verify a safe authoritative MCP/host-input integration surface. [CITED: https://aider.chat/docs/] | Remain explicitly Unsupported for this phase unless official docs plus installed testing prove a safe lifecycle surface. | `Unsupported` pending proof, as required by HST-04. |

## Architecture Patterns

### Evidence state machine

```text
official-doc review
        ↓
candidate record (Researching)
        ↓ install exact host in isolated environment
        ↓ adapter registration + doctor + config snapshot
        ↓ fake-host / process conformance
        ↓ authenticated manual long-round scenarios
        ↓ fresh install → upgrade → uninstall → trust/scope checks
        ↓ Supported / Experimental / Unsupported
```

The matrix must store at least: host, product/channel, exact version, OS, transport, config scope, approval/trust assumptions, timeout/deadline owner, cancellation/disconnect semantics, scenario, command, result, evidence date, limitation, and evidence class. [VERIFIED: Phase 12 capability-card and acceptance artifacts]

### Recommended project structure

```text
docs/host-capability-cards/<host>.md
test/host-compatibility.test.js
test/host-compatibility-evidence.json
test/cross-platform-evidence.md
docs/hosts.md
docs/testing.md
docs/maintenance.md
```

Keep product code unchanged during the research/documentation wave. If an adapter later passes the gate, add a host-specific registration module rather than broadening `target` auto-detection to every MCP-capable application.

### Candidate onboarding pattern

For each host: cite official docs; record exact installed version; use a temporary home/workspace; register only the local MCP server; inspect resulting config; run initialize/tool discovery; run the lifecycle conformance harness; perform idle, disconnect/reconnect, restart, cancel, exact recovery, result replay, and acknowledgement; then repeat install/upgrade/uninstall and inspect that unrelated host config is unchanged.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Host compatibility claims | Ad hoc README prose or inferred “MCP-compatible” labels | One machine-readable evidence ledger rendered into cards/matrix | Prevents stale, contradictory, and payload-leaking claims. |
| Host protocol implementation | A generic wrapper that assumes all hosts share timeout/cancel semantics | Existing MCP server plus explicit adapter seams and fake-host harness | Phase 12 explicitly preserves host-specific framing and lifecycle semantics. [VERIFIED: `docs/adapter-contract.md`] |
| Cross-platform filesystem proof | macOS-only tests or path string assumptions | OS-specific isolated fixtures and manual evidence captures | Permissions, path roots, atomic rename, process spawning, and config locations differ by OS. |
| Secret/privacy validation | Manual inspection alone | Redaction assertions and allowlisted evidence fields | Diagnostics must never contain question/answer content or credentials. |

## Common Pitfalls

### MCP discoverability mistaken for support
**What goes wrong:** A host lists the tool but cannot hold an interactive call, preserve disconnect recovery, or deliver an acknowledgement. **Why:** MCP discovery proves only protocol visibility. **How to avoid:** Require the complete installed-host scenario set before `Supported`. **Warning sign:** A card has a transport/config row but no exact version, scenario command, or authenticated result.

### Config scope and trust policy mutation
**What goes wrong:** An installer writes project config when the user expected global config, or a trusted/untrusted workspace changes whether stdio starts. **How to avoid:** Test global, workspace, and clean-home cases; snapshot unrelated settings before and after. Official docs explicitly expose these scope/trust distinctions for Gemini, Kiro, Roo, and Cursor. [CITED: https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md] [CITED: https://kiro.dev/docs/cli/mcp/configuration/] [CITED: https://roocodeinc.github.io/Roo-Code/features/mcp/using-mcp-in-roo/] [CITED: https://docs.cursor.com/context/model-context-protocol]

### Host deadlines hidden by application timeout settings
**What goes wrong:** A host closes a pending call while the local bridge remains healthy. **How to avoid:** Record host deadline owner and observe transport close/reconnect; never claim that a one-hour bridge setting overrides a host wall-clock limit. [VERIFIED: `docs/hosts.md`, Phase 12 verification]

### Cross-platform evidence theater
**What goes wrong:** A test passes on macOS and is described as supported everywhere. **How to avoid:** Require fresh OS evidence for permissions, durable snapshots, restart/corruption handling, retention expiry, browser launch fallback, and installer paths on macOS, Linux, and Windows.

### Evidence leakage
**What goes wrong:** Logs or matrix fixtures contain synthetic or real question/answer text, tokens, or absolute sensitive paths. **How to avoid:** Use opaque IDs, lifecycle states, timings, redacted errors, and a negative-content scan. [VERIFIED: project conventions and Phase 12 threat model]

## Cross-Platform Verification Constraints

The current environment is macOS arm64 with Node `v26.0.0`, npm `11.12.1`, Bash 3.2, and ShellCheck available. [VERIFIED: local command] It does not provide Linux or Windows execution, and no expansion host is installed except OpenCode. Therefore QLT-01 and QLT-03 cannot honestly be closed from this checkout alone.

Required evidence lanes:

1. macOS: clean HOME/XDG/CODEX-style roots, restrictive permissions, bridge restart, corrupt/partial snapshot quarantine, retention expiry, browser opening fallback, shell installer, and installed-host registration.
2. Linux: the same matrix plus distro shell/process-path behavior and executable discovery.
3. Windows: native PowerShell/installer path, `%APPDATA%`/host config locations, process termination/stdio behavior, permissions, path quoting, and browser fallback. WSL is not equivalent to native Windows evidence.

Record OS version, architecture, Node version, host version, exact command, config root, scenario result, and evidence date. Do not install missing hosts in this research environment.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---:|---|---|
| Node.js | Tests/bridge | ✓ | 26.0.0 (project requires >=18) | — |
| npm | Clean install/package gates | ✓ | 11.12.1 | — |
| Bash | Shell syntax/install checks | ✓ | 3.2 | — |
| ShellCheck | Shell quality gate | ✓ | available | — |
| ESLint | Lint gate | ✗ | — | Run in CI/clean environment with dev tools; do not claim local pass. |
| Prettier | Format gate | ✗ | — | Run in CI/clean environment with dev tools; do not install for research. |
| Claude Code | Tier 1 live gate | ✓ | 2.1.201 | Authenticated lifecycle run still not performed. |
| Codex CLI | Tier 1 live gate | ✓ | 0.144.4 | Authenticated lifecycle run still not performed. |
| OpenCode | Candidate manual gate | ✓ | 1.15.12 | Requires authenticated installed-host conformance. |
| Expansion cohort binaries | Phase 13 host gates | ✗ | — | Dedicated verification machines; no product claim until installed. |

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Native `node:test` |
| Config file | None |
| Quick run command | `node --test test/host-compatibility.test.js` (Wave 0) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test type | Automated command | File exists? |
|---|---|---|---|---:|
| HST-02–HST-04 | Every candidate has one evidence state and no unsupported promotion | unit/document integrity | `node --test test/host-compatibility.test.js` | ❌ Wave 0 |
| HST-05–HST-06 | JSON and Markdown matrix agree; unsupported rationale is present | unit/document integrity | same | ❌ Wave 0 |
| QLT-01 | Durable store/recovery scenarios are recorded per OS | integration/manual evidence | `node --test test/settings.test.js test/server.test.js test/round-lifecycle.test.js` plus OS handoff | Partial |
| QLT-02 | Clean release gates pass | release | `npm test && npm run lint && npm run format:check && npm pack --dry-run --json` | Existing commands |
| QLT-03 | Installer scope/idempotency is proven per claimed host | integration/manual | `node --test test/cli-adapters.test.js test/install.test.js` plus installed-host runs | Partial |
| DOC-06–DOC-08 | Maintained docs contain recovery, privacy, and redaction guidance | document integrity | `node --test test/docs-integrity.test.js test/host-compatibility.test.js` | ❌ Wave 0 |

### Sampling rate

- Per task: focused `node:test` command.
- Per wave: `npm test`, shell syntax, and evidence redaction scan.
- Phase gate: clean-checkout release commands plus required manual OS/host evidence before `$gsd-verify-work`.

### Wave 0 gaps

- [ ] `test/host-compatibility.test.js` and `test/host-compatibility-evidence.json` — schema, status, date, required fields, and redaction checks.
- [ ] Capability cards and matrix for all 11 named candidates plus Aider.
- [ ] OS evidence fixture/template with macOS/Linux/Windows rows.
- [ ] Direct official documentation refresh for Kilo Code and Windsurf.
- [ ] Installed-host manual harness/runbook; no local substitute can close authenticated evidence.

## Security Domain

| ASVS category | Applies | Standard control |
|---|---:|---|
| V2 Authentication | yes | Host authentication is external/manual evidence; bridge remains local and unauthenticated only on loopback. |
| V3 Session Management | yes | Opaque round/capability selectors, exact recovery, immutable result, idempotent acknowledgement. [VERIFIED: Phase 12 contract] |
| V4 Access Control | yes | `127.0.0.1` binding, host-scoped installer mutations, workspace/global scope checks, tool approval/trust checks. |
| V5 Input Validation | yes | Existing shared question contract and JSON/config validation at boundaries. [VERIFIED: codebase grep] |
| V6 Cryptography | conditional | Do not add credentials or remote auth; if a candidate requires OAuth/headers, keep secrets outside evidence and use host-native storage. |

Known threat patterns: malicious or misconfigured MCP commands can execute with host privileges; official Kiro documentation explicitly warns that stdio commands run in the environment with the agent's privileges. [CITED: https://kiro.dev/docs/autonomous-agent/sandbox/mcp/] Mitigate with explicit command review, host trust/approval capture, no arbitrary imported commands, loopback-only bridge, and redacted diagnostics.

## Recommended Plan Split

1. **Evidence model and matrix (Wave 1):** define JSON schema/status vocabulary, add integrity/redaction tests, create dated cards for every candidate, and keep all unverified rows `Researching` or `Unsupported`.
2. **Official-doc and candidate registration research (Wave 1/2):** refresh Kilo Code/Windsurf sources; document config/transport/install implications; do not alter production target auto-detection yet.
3. **Installed-host gates (Wave 2):** use dedicated authenticated environments, starting with OpenCode (available locally) and the HST-02 cohort; run exact lifecycle, timeout, approval, install/upgrade/uninstall, and scope scenarios. Promote only after evidence passes.
4. **Cross-platform hardening (Wave 2/3):** run the durable-store, permissions, restart/corruption, retention, browser, shell, and installer matrix on native macOS/Linux/Windows. Treat WSL as separate evidence.
5. **Launch/release documentation (Wave 3):** reconcile `docs/hosts.md`, `docs/testing.md`, troubleshooting/privacy docs, capability cards, compatibility matrix, changeset/package checks, and clean-checkout CI evidence.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | OpenCode `1.15.12` can be used for a local manual gate without additional authentication setup. | Environment / plan split | Manual run may be blocked or require a different product/channel. |
| A2 | The project can maintain one shared JSON evidence schema without adding runtime dependencies. | Standard stack / architecture | Scope or tooling may need adjustment. |
| A3 | Candidate host CLI and IDE products may expose materially different lifecycle semantics even when both support MCP. | Candidate table | Wrong adapter boundary could produce false support claims. |

## Open Questions

1. **Which exact product/channel/version is in scope for each host?** Official docs often cover both CLI and IDE/extension variants. Resolve by installing one version-pinned target per candidate before promotion.
2. **Does each host preserve a pending stdio call across browser-long idle periods and transport loss?** Only a manual authenticated long-round run can answer this.
3. **What are the native install/uninstall and trust-policy surfaces for Kilo Code and Windsurf?** Direct authoritative documentation and installed inspection are required.
4. **Can native Windows verification be scheduled?** The current macOS environment cannot close QLT-01/QLT-03 for Windows.

## Sources

### Primary (HIGH confidence)

- Local repository: `AGENTS.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, Phase 12 plans/summaries/verification, `docs/adapter-contract.md`, `docs/hosts.md`, `docs/testing.md`, and adapter/test source. [VERIFIED: codebase grep/read]
- GitHub Copilot CLI MCP docs — https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers
- Gemini CLI MCP docs — https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md
- Amazon Q MCP docs — https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/qdev-mcp.html

### Secondary (MEDIUM confidence)

- Cursor MCP docs — https://docs.cursor.com/context/model-context-protocol
- Cline MCP/CLI docs — https://docs.cline.bot/mcp/mcp-overview and https://docs.cline.bot/cli/cli-reference
- Kiro MCP/CLI docs — https://kiro.dev/docs/cli/mcp/configuration/
- Qwen Code settings — https://github.com/QwenLM/qwen-code/blob/main/docs/users/configuration/settings.md
- OpenCode docs — https://opencode.ai/docs/tools/ and https://dev.opencode.ai/docs/cli/
- Roo Code MCP docs — https://roocodeinc.github.io/Roo-Code/features/mcp/using-mcp-in-roo/

### Tertiary (LOW confidence / not used for promotion)

- Windsurf configuration reference encountered through a third-party setup page — https://developers.cloudflare.com/agent-setup/windsurf/; insufficient to establish official product behavior.
- Aider official overview — https://aider.chat/docs/; no safe MCP host-input surface verified in this session.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — grounded in the repository's existing zero-dependency Node/test architecture.
- Candidate transport/configuration: MEDIUM — official docs establish configuration surfaces, not lifecycle compatibility.
- Installed-host and cross-platform status: HIGH confidence that evidence is unavailable locally; LOW confidence for any unexecuted host behavior, intentionally not promoted.

**Research date:** 2026-07-17
**Valid until:** 2026-07-24 for fast-moving host documentation; refresh immediately before planning/execution.
