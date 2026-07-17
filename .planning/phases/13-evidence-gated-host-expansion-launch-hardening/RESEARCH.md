# Phase 13: Evidence-Gated Host Expansion & Launch Hardening - Research

**Researched:** 2026-07-17  
**Domain:** Host compatibility evidence, cross-platform durable-storage verification, release hardening  
**Confidence:** MEDIUM

## Summary

Phase 12 leaves a strong local evidence base: the adapter contract, fake-host conformance, scoped installer tests, and Tier 1 evidence matrix are complete, while authenticated Claude Code/Codex rows remain explicitly `Unavailable`. [VERIFIED: codebase grep — `.planning/phases/12-adapter-contract-tier-1-acceptance/12-VERIFICATION.md`, `12-04-SUMMARY.md`]

Official documentation confirms that Cursor, GitHub Copilot CLI, Gemini CLI, Amazon Q Developer, Cline, Kiro, Qwen Code, and OpenCode expose some MCP or tool configuration surface. [CITED: https://docs.cursor.com/guides/mcp] [CITED: https://docs.github.com/en/enterprise-cloud%40latest/copilot/reference/copilot-cli-reference/cli-command-reference] [CITED: https://geminicli.com/docs/tools/mcp-server/] [CITED: https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/qdev-mcp.html] [CITED: https://docs.cline.bot/mcp/mcp-overview] [CITED: https://kiro.dev/docs/mcp/usage/] [CITED: https://github.com/QwenLM/qwen-code/blob/main/docs/users/configuration/settings.md] [CITED: https://github.com/opencode-ai/opencode/blob/main/README.md] This is discovery evidence only. It does not establish that the host can preserve a long pending request, detach and resume safely, deliver an immutable result, or obey the project's loopback/privacy constraints. [VERIFIED: codebase grep — Phase 12 capability-card and acceptance rules]

**Primary recommendation:** Split the phase into (1) evidence and matrix infrastructure, (2) candidate-by-candidate official review plus isolated installation/manual verification, and (3) macOS/Linux/Windows durability and clean-release gates; promote a host only after every required evidence row is fresh and redacted.

## User Constraints

- Do not install external hosts in the research environment. [VERIFIED: user request]
- Preserve Node.js 18+, zero production dependencies, loopback-only operation, and the current distribution contract. [VERIFIED: AGENTS.md project constraints]
- Do not infer support from MCP discoverability alone; research Roo Code and Windsurf individually, and keep Aider unsupported unless a safe authoritative surface is proven. [VERIFIED: ROADMAP.md]

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HST-02 | Evaluate Cursor, GitHub Copilot CLI, Gemini CLI, and Amazon Q Developer with evidence-backed statuses. | Candidate evidence classification and cohort gate below. |
| HST-03 | Evaluate Cline, Kiro, Kilo Code, Qwen Code, and OpenCode through the same adapter gate. | Uniform per-host gate and official-surface findings below. |
| HST-04 | Research Roo Code and Windsurf individually; keep Aider unsupported absent safe proof. | Individual research requirement and Aider disposition below. |
| HST-05 | Publish machine-readable and user-facing compatibility matrix. | Recommended matrix schema and ownership below. |
| HST-06 | Explain hosts that cannot safely integrate. | Evidence-state taxonomy and unsupported rationale below. |
| QLT-01 | Verify durable recovery on macOS, Linux, and Windows. | Cross-platform verification constraints below. |
| QLT-02 | Pass clean-checkout tests, lint, formatting, shell, packaging, and release checks. | Release split and current environment gaps below. |
| QLT-03 | Cover fresh install, upgrade, uninstall, trust, and configuration scope for every claimed supported host. | Candidate gate below. |
| DOC-06 | Maintain settings, recovery, timeout, acknowledgement, and troubleshooting docs. | Documentation workstream below. |
| DOC-07 | Maintain a capability card for every host. | Matrix/card structure below. |
| DOC-08 | Keep diagnostics and recovery artifacts redacted and document local privacy/retention. | Security and evidence rules below. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Host capability discovery and status | Documentation / Release evidence | Host adapters | Public support claims depend on dated host/version/scenario evidence, not bridge protocol shape. [VERIFIED: ROADMAP.md; Phase 12 cards] |
| Candidate transport adapter | Host adapter / API boundary | Local bridge | Host framing, timeout, cancellation, approval, and response semantics belong to the adapter boundary. [VERIFIED: Phase 12 adapter contract] |
| Durable round recovery | Database / Storage | API / Backend | The bridge's versioned local-disk record is authoritative; browser/host state is not the source of truth. [VERIFIED: ARCHITECTURE.md and Phase 9 artifacts] |
| Cross-platform install/config scope | Host adapter / OS integration | Release packaging | Each host's config paths, trust policy, and uninstall ownership must be tested independently on each OS. [VERIFIED: Phase 12 installer tests; candidate official docs] |
| Compatibility matrix and support docs | Release evidence / Documentation | — | Machine-readable data and user-facing cards must derive from the same evidence rows. [ASSUMED — recommended design; validate against existing documentation conventions] |

## Candidate Host Evidence Classification

Use exactly four public states: `Supported`, `Experimental`, `Researching`, and `Unsupported`. [VERIFIED: ROADMAP.md]

| Host | Official surface found | Initial classification | Evidence needed before promotion | Key constraint |
|------|------------------------|------------------------|----------------------------------|----------------|
| Cursor | MCP documentation exists. [CITED: https://docs.cursor.com/guides/mcp] | Researching | Version-pinned install/config scope, trust prompts, long-round hold, disconnect/reconnect, cancel, result/ack, upgrade/uninstall on each claimed OS | Cursor is primarily an IDE surface; do not assume CLI/process semantics from MCP docs. [ASSUMED] |
| GitHub Copilot CLI | Official CLI supports user/workspace MCP config and local/stdio/http/sse types. [CITED: https://docs.github.com/en/enterprise-cloud%40latest/copilot/reference/copilot-cli-reference/cli-command-reference] | Researching | CLI version, config precedence, approval/trust behavior, stdin/transport lifetime, long-round and cancellation evidence, scoped installer lifecycle | `.mcp.json` migration and user config are distinct surfaces; test both scope and precedence. [CITED: https://docs.github.com/en/enterprise-cloud%40latest/copilot/reference/copilot-cli-reference/cli-command-reference] |
| Gemini CLI | Official MCP management supports user/project scopes and stdio/HTTP configuration. [CITED: https://geminicli.com/docs/tools/mcp-server/] | Researching | Version, scope, `/mcp` enablement, auth/approval behavior, host timeout and cancellation, reconnect/restart, install lifecycle | Session-only enablement exists; distinguish ephemeral session state from persisted config. [CITED: https://geminicli.com/docs/tools/mcp-server/] |
| Amazon Q Developer | Official docs describe local/remote MCP, CLI config, init timeout, permissions, and IDE global/local scopes. [CITED: https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/qdev-mcp.html] [CITED: https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/mcp-ide.html] | Researching | CLI versus IDE identity, account/org MCP governance, approval levels, timeout, local config scope, long-round and uninstall evidence | Organization policies can disable or allow-list MCP and must be captured as a limitation. [CITED: https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/mcp-governance.html] |
| Cline | Official docs expose MCP and a CLI `mcp` surface. [CITED: https://docs.cline.bot/mcp/mcp-overview] [CITED: https://docs.cline.bot/cli/cli-reference] | Researching | Determine whether the installed CLI or extension is the supported integration target; verify host lifecycle and plugin/config scope separately | Cline also has hooks/plugins; do not select one integration path without version-pinned evidence. [CITED: https://docs.cline.bot/cli/cli-reference] |
| Kiro | Official docs expose MCP, permission/trust behavior, and enterprise governance. [CITED: https://kiro.dev/docs/cli/quick-start/] [CITED: https://kiro.dev/docs/mcp/security/] | Researching | CLI/IDE product identity, MCP config path, trust prompts, governance fail-closed behavior, long-round lifecycle, install/upgrade/uninstall | Organization governance may suppress all MCP or enforce a registry; treat that as a support limitation. [CITED: https://kiro.dev/docs/enterprise/governance/mcp/] |
| Kilo Code | No authoritative official result was obtained in this session. [VERIFIED: web search attempted; no authoritative result selected] | Researching | Locate first-party docs/repository, establish target surface and version, then run the full gate | No support claim is justified from the name or ecosystem similarity. [VERIFIED: ROADMAP.md principle] |
| Qwen Code | Official repository docs expose `mcpServers`, stdio/URL/httpUrl, timeout, trust, allow/deny tools, and folder trust settings. [CITED: https://github.com/QwenLM/qwen-code/blob/main/docs/users/configuration/settings.md] | Researching | Pin release, config precedence, trust and permissions, timeout/disconnect behavior, cross-platform install lifecycle | Repository documentation is authoritative for the project but must be pinned to a release/commit before public claims. [ASSUMED — release-pinning recommendation] |
| OpenCode | Official repository README documents MCP, stdio/SSE, permission system, and user/XDG/project config locations. [CITED: https://github.com/opencode-ai/opencode/blob/main/README.md] | Researching | Pin release, verify config precedence, permission prompts, process lifetime, recovery/cancel, packaging and uninstall | Current repository documentation may describe a moving development surface; use a release artifact, not `main`, for evidence. [ASSUMED — release-pinning recommendation] |
| Roo Code | No authoritative official result was obtained in this session. [VERIFIED: web search attempted; no authoritative result selected] | Researching | Research individually from first-party docs/repository; identify whether an extension/CLI/hook/MCP surface exists | Never inherit Cline status or assume MCP compatibility. [VERIFIED: ROADMAP.md] |
| Windsurf | No authoritative official result was obtained in this session. [VERIFIED: web search attempted; no authoritative result selected] | Researching | Research individually from first-party docs; identify supported extension/CLI/MCP surface and lifecycle ownership | Never inherit Cursor status or infer support from a shared editor ecosystem. [VERIFIED: ROADMAP.md] |
| Aider | Official docs describe terminal pairing/configuration, but no safe authoritative host adapter surface was established here. [CITED: https://aider.chat/docs/] | Unsupported | Reopen only if first-party docs prove a safe request/response extension surface and the full gate can be run | Keep explicitly Unsupported for this phase; ordinary CLI configuration is not evidence of host lifecycle integration. [VERIFIED: REQUIREMENTS.md; ROADMAP.md] |

### Status rules

- `Supported`: official surface, version-pinned installed host, fresh-install/upgrade/uninstall/trust/scope evidence, fake-host conformance, manual long-round recovery/cancel/result/ack evidence, and redacted evidence on every claimed OS. [VERIFIED: REQUIREMENTS.md ADP-06, QLT-03]
- `Experimental`: the full adapter and manual scenarios work, but one bounded limitation remains, such as one OS, one transport, or a documented host deadline. [ASSUMED — recommended operational definition]
- `Researching`: official surface or plausible integration lead exists, but installed-host evidence is missing or incomplete. [VERIFIED: Phase 12 evidence policy]
- `Unsupported`: no safe authoritative integration surface, or the host fails a security/lifecycle gate. [VERIFIED: REQUIREMENTS.md HST-06]

## Cross-Platform Verification Constraints

The current machine is macOS Darwin arm64 with Node 26.0.0, npm 11.12.1, Bash, Git, and ShellCheck available; ESLint and Prettier are absent. [VERIFIED: environment probe] The repository requires Node `>=18` and CI is designed for Node 18/20/22. [VERIFIED: package.json; docs/testing.md]

Node officially distinguishes `darwin`, `linux`, and `win32` through `process.platform`, and temporary-directory conventions differ between Windows and POSIX. [CITED: https://nodejs.org/download/release/v18.20.3/docs/api/os.html] Therefore a macOS-only run cannot establish Windows path, permissions, newline, process-signal, or installer behavior.

Required verification matrix:

| Area | macOS | Linux | Windows |
|------|-------|-------|---------|
| Node 18+ clean checkout | Required on an actual supported runner | Required on an actual supported runner | Required on an actual supported runner |
| Durable store | Crash/partial-write/quarantine, restrictive permissions, restart, expiry | Same, including filesystem/permission behavior | Same, including path/locking/rename behavior |
| Browser/bridge | Loopback binding, port/origin drift, recovery and delivery | Same | Same, plus Windows path and process termination behavior |
| Installer | Shell lifecycle and host scope | Shell lifecycle and host scope | Native host/config procedure; do not assume POSIX shell semantics |
| Host evidence | Only claim hosts tested on this OS/version | Separate evidence rows | Separate evidence rows |

Node's `fs` APIs document rename and file operations but do not make a product-level crash-durability claim by themselves. [CITED: https://nodejs.org/api/fs.html] The plan must therefore test the project's actual atomic-write sequence, permissions, restart recovery, quarantine, and retention behavior on all three OS families; a passing unit test on macOS is insufficient. [VERIFIED: Phase 9 research flags; REQUIREMENTS.md QLT-01]

## Recommended Plan Split

### Plan 13-01 — Evidence schema and candidate capability-card matrix

Create the machine-readable evidence fixture and user-facing matrix/card template, reusing the Phase 12 evidence vocabulary. Add strict validation for host name, exact version, transport, scope, scenarios, limitations, evidence date, status, source URLs, and redaction. Keep all 11 named candidates plus Aider present; default unknowns to `Researching`, never `Supported`. [VERIFIED: HST-02–HST-06; ASSUMED — fixture format should reuse existing no-dependency Node/Markdown approach]

### Plan 13-02 — Official-document refresh and isolated candidate gates

For each candidate, record first-party docs, target surface, config scope, trust/approval, timeout/cancellation clues, installation ownership, and unresolved questions. Use fake-host/conformance tests and isolated temporary homes for config mutation; do not install external hosts in the project environment. Promote only after a maintainer runs the host-specific version-pinned procedure in a separate environment. [VERIFIED: ADP-06; user constraint]

### Plan 13-03 — Cross-platform durable recovery and installer evidence

Run the same recovery scenarios on macOS, Linux, and Windows: idle long round, browser refresh/reconnect, host detach/resume, bridge restart, corrupt/partial record, exact round selection, immutable result replay, acknowledgement retry, expiry, restrictive permissions, and loopback binding. Add per-OS install/upgrade/uninstall/trust/config-scope evidence for every host that could become `Supported`. [VERIFIED: QLT-01, QLT-03; Phase 9/12 artifacts]

### Plan 13-04 — Launch hardening, documentation, and release gate

From a clean checkout run `npm ci`, tests, lint, formatting, shell checks, audit, package dry-run, and release checks; document missing local tools as environment gaps rather than silently installing them. [VERIFIED: docs/testing.md; Phase 12 verification] Update settings/recovery/troubleshooting/privacy docs and make capability cards/matrix derive from the same evidence rows. [VERIFIED: DOC-06–DOC-08]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Host support claims | Ad hoc prose or protocol inference | One validated evidence fixture feeding cards and matrix | Prevents status drift and unsupported claims. [ASSUMED — recommended design] |
| Host lifecycle proof | MCP discovery smoke only | Phase 12 adapter contract and fake-host conformance seams plus manual host runs | Discovery does not prove timeout, disconnect, cancellation, or delivery semantics. [VERIFIED: Phase 12 artifacts; official candidate docs] |
| Durable persistence | New storage layer for evidence | Existing versioned round store and atomic-write path | Preserves the established bridge authority and zero-production-dependency constraint. [VERIFIED: ARCHITECTURE.md; PROJECT.md] |
| Cross-platform coverage | OS emulation as release proof | Actual macOS/Linux/Windows runners or manually captured environments | Path, permission, process, and installer behavior are OS-dependent. [CITED: https://nodejs.org/download/release/v18.20.3/docs/api/os.html] |

## Common Pitfalls

### Protocol discoverability mistaken for support

**What goes wrong:** A host lists an MCP server, so the project labels it Supported. **Why:** Official docs describe configuration, not the host's request deadline or delivery semantics. **How to avoid:** Require version-pinned manual long-round, detach/resume, restart, cancel, result, acknowledgement, trust, and scope evidence. **Warning signs:** The evidence contains only config JSON, `/mcp` output, or tool discovery. [VERIFIED: official docs and Phase 12 policy]

### Scope and governance drift

**What goes wrong:** An installer edits global config while the user expects workspace scope, or organization policy disables MCP. **How to avoid:** Test global/project/session scope and record policy limitations per host. [CITED: https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/mcp-ide.html] [CITED: https://kiro.dev/docs/enterprise/governance/mcp/] [CITED: https://geminicli.com/docs/tools/mcp-server/]

### macOS-only durability confidence

**What goes wrong:** Atomic-write and recovery tests pass on macOS but fail on Windows/Linux. **How to avoid:** Execute the same crash/permission/restart/expiry matrix on all three OS families and capture filesystem-specific failures. [VERIFIED: QLT-01; Node OS docs]

### Evidence leakage

**What goes wrong:** Host logs or capability artifacts contain question/answer text or tokens. **How to avoid:** Allowlist opaque IDs, states, timings, versions, and redacted errors; scan artifacts before publication. [VERIFIED: Phase 12 security verification; DOC-08]

### Moving documentation treated as a stable contract

**What goes wrong:** A `main` branch README or current web page changes after evidence is recorded. **How to avoid:** Store URL, access date, host version, and repository commit/release where applicable. [ASSUMED — recommended evidence hygiene]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Native `node:test`, version supplied by Node runtime. [VERIFIED: package.json; docs/testing.md] |
| Config file | None. [VERIFIED: docs/testing.md] |
| Quick run command | `node --test test/tier1-acceptance.test.js` plus the new evidence-matrix/platform-focused tests. [VERIFIED: Phase 12 artifacts] |
| Full suite command | `npm test` [VERIFIED: package.json] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HST-02–HST-06 | Matrix contains every candidate, valid evidence states, dates, sources, limitations, and unsupported rationale | Unit/contract | `node --test test/host-evidence-matrix.test.js` | ❌ Wave 0 |
| QLT-01 | Recovery/storage behavior passes on macOS, Linux, Windows | Integration/manual OS matrix | `npm test` per OS plus manual evidence runner | ❌ Wave 0 |
| QLT-02 | Clean release gates pass | Release smoke | documented release command set | Partial; existing docs |
| QLT-03 | Claimed supported host lifecycle is scoped and repeatable | Integration/manual host | host-specific evidence procedure | ❌ Wave 0 |
| DOC-06–DOC-08 | Maintained docs/cards are complete and redacted | Documentation contract | `node --test test/docs-integrity.test.js test/host-evidence-matrix.test.js` | Partial |

### Wave 0 Gaps

- [ ] `test/host-evidence-matrix.test.js` — schema/status/source/redaction validation. [ASSUMED — new test name]
- [ ] Machine-readable compatibility fixture and per-host cards — exact paths should follow existing docs conventions. [ASSUMED]
- [ ] Linux and Windows runners or documented manual capture environments for durable-store evidence. [VERIFIED: current environment is macOS only]
- [ ] ESLint and Prettier availability in the clean-checkout/release environment; current workspace lacks both binaries. [VERIFIED: environment probe]

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Limited | Hosts may require their own auth; never copy credentials into evidence. [VERIFIED: project local single-user model; candidate docs] |
| V3 Session Management | Yes | Exact round/request/capability selectors, detach/resume ownership, immutable result and acknowledgement. [VERIFIED: Phase 8–12 contracts] |
| V4 Access Control | Yes | Loopback-only bridge, scoped host config mutation, trust/approval evidence, stale selector rejection. [VERIFIED: PROJECT.md; Phase 12 security] |
| V5 Input Validation | Yes | Validate candidate fixture fields, host versions, statuses, URLs, and redacted evidence before publication. [ASSUMED — required implementation control] |
| V6 Cryptography | Limited | Do not introduce custom cryptography; preserve existing local secret/config handling and never publish tokens. [VERIFIED: PROJECT.md; Phase 12 security] |

## Code Examples

The planner should reuse the existing Phase 12 matrix and redaction patterns rather than create a new runtime adapter abstraction. [VERIFIED: Phase 12 artifacts]

```js
// Evidence row shape — recommended documentation/test fixture, not production code.
{
  host: 'gemini-cli',
  status: 'Researching',
  version: null,
  transport: 'unknown',
  scenarios: [],
  limitations: ['No installed-host run recorded'],
  evidenceDate: '2026-07-17',
  sources: ['https://geminicli.com/docs/tools/mcp-server/'],
  redacted: true,
}
```

The important invariant is that absent version/scenario evidence remains `Researching`; the fixture must reject a `Supported` row with missing live evidence. [VERIFIED: Phase 12 evidence policy; ASSUMED — exact validator behavior to implement]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Tests, bridge, evidence tooling | ✓ | 26.0.0; project baseline `>=18` | Use CI Node 18/20/22 for compatibility evidence. [VERIFIED: environment probe; package.json] |
| npm | Clean install/package gates | ✓ | 11.12.1 | — [VERIFIED: environment probe] |
| Bash | Shell syntax/lifecycle checks | ✓ | system | Native Windows procedure required for Windows host evidence. [VERIFIED: environment probe; QLT-01] |
| ShellCheck | Shell release gate | ✓ | installed | — [VERIFIED: environment probe] |
| ESLint | Lint gate | ✗ | — | Run in clean CI/release environment; do not install during research. [VERIFIED: environment probe; user constraint] |
| Prettier | Formatting gate | ✗ | — | Run in clean CI/release environment; do not install during research. [VERIFIED: environment probe; user constraint] |
| Linux/Windows environments | QLT-01 | ✗ locally | — | CI runners or explicitly captured supported machines. [VERIFIED: environment probe; QLT-01] |
| Candidate host binaries/authentication | HST-02–HST-04 | ✗ intentionally not installed | — | Research docs now; schedule isolated human-run evidence before promotion. [VERIFIED: user request; Phase 12 verification] |

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Treat MCP discoverability as compatibility | Treat discoverability as a research lead, then require lifecycle/install/platform evidence | Prevents false Supported claims. [VERIFIED: Phase 12 policy; official docs] |
| One host card for a whole editor family | Individual dated cards for every named host | Prevents Cursor/Cline/Roo/Windsurf or CLI/IDE semantics from being conflated. [VERIFIED: ROADMAP.md; REQUIREMENTS.md] |
| Local macOS test as release proof | Three-OS evidence matrix plus clean-checkout release gate | Exposes filesystem, process, permission, and installer differences. [VERIFIED: QLT-01; Node OS docs] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A single no-dependency evidence fixture should feed matrix and cards. | Responsibility map / Plan 13-01 | Planner may choose paths inconsistent with existing docs/test conventions. |
| A2 | `Experimental` should mean lifecycle works with a bounded documented limitation. | Status rules | Public status semantics may need product-owner confirmation. |
| A3 | Candidate release docs/repositories should be pinned by version or commit. | Candidate table / pitfalls | Evidence may become non-reproducible as docs change. |
| A4 | A new `test/host-evidence-matrix.test.js` is the appropriate Wave 0 test name. | Validation architecture | Existing test naming/layout may prefer another file. |

## Open Questions

1. **Which actual Linux and Windows environments are release-supported?**
   - What we know: Requirements require verification on macOS, Linux, and Windows. [VERIFIED: QLT-01]
   - What's unclear: Exact distro, filesystem, Node versions, and Windows shell/architecture support.
   - Recommendation: Lock a small CI/manual environment matrix before assigning `Supported`.

2. **Which host surface is in scope where a product has both CLI and IDE forms?**
   - What we know: Amazon Q, Cline, Gemini, and Kiro document multiple surfaces/scopes. [CITED: official URLs above]
   - What's unclear: Which executable/session owns timeout, cancellation, and response delivery for each product.
   - Recommendation: Give each tested executable or IDE surface its own capability-card identity.

3. **Can every candidate be safely installed without changing the zero-dependency package?**
   - What we know: Phase 12 preserves zero production dependencies and avoids external host installation. [VERIFIED: PROJECT.md; Phase 12 context]
   - What's unclear: Whether a candidate needs marketplace extensions, native binaries, or remote registration.
   - Recommendation: Keep candidates `Researching` until installation scope and uninstall ownership are documented and manually verified.

## Sources

### Primary (HIGH confidence)

- Project `ROADMAP.md`, `REQUIREMENTS.md`, Phase 12 context/verification/security — phase scope, locked evidence rules, and existing contracts. [VERIFIED: codebase grep]
- [GitHub Copilot CLI command reference](https://docs.github.com/en/enterprise-cloud%40latest/copilot/reference/copilot-cli-reference/cli-command-reference) — MCP types and configuration scopes. [CITED]
- [Gemini CLI MCP documentation](https://geminicli.com/docs/tools/mcp-server/) — scopes and MCP lifecycle commands. [CITED]
- [Amazon Q MCP documentation](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/qdev-mcp.html) and [IDE configuration](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/mcp-ide.html) — local/remote transports, scopes, timeout, permissions. [CITED]
- [Node.js v18 OS documentation](https://nodejs.org/download/release/v18.20.3/docs/api/os.html) and [filesystem documentation](https://nodejs.org/api/fs.html) — platform and filesystem API constraints. [CITED]

### Secondary (MEDIUM confidence)

- [Cursor MCP guide](https://docs.cursor.com/guides/mcp), [Cline MCP overview](https://docs.cline.bot/mcp/mcp-overview), [Kiro MCP usage](https://kiro.dev/docs/mcp/usage/), [Qwen Code settings](https://github.com/QwenLM/qwen-code/blob/main/docs/users/configuration/settings.md), [OpenCode README](https://github.com/opencode-ai/opencode/blob/main/README.md) — official surfaces requiring installed-host verification. [CITED]
- [Aider documentation](https://aider.chat/docs/) — terminal pairing/configuration surface; insufficient by itself for safe lifecycle integration. [CITED]

### Tertiary (LOW confidence)

- Kilo Code, Roo Code, and Windsurf: no authoritative source was selected during this session; remain `Researching` pending individual first-party lookup. [VERIFIED: web search attempted]

## Metadata

**Confidence breakdown:**
- Candidate official surfaces: MEDIUM — official docs reviewed, but no hosts installed or authenticated.
- Architecture and plan split: HIGH — grounded in roadmap, requirements, Phase 12 artifacts, and existing stack docs.
- Cross-platform constraints: MEDIUM — Node and project constraints are documented, but Linux/Windows execution is unavailable here.

**Research date:** 2026-07-17  
**Valid until:** 2026-07-24 for host-surface findings; 2026-08-16 for stable project-architecture findings.
