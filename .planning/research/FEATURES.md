# Feature Landscape: Public-Launch Local Question Bridge

**Domain:** Local browser question/answer bridge for AI coding hosts
**Milestone:** v1.1 Sprint 2 (new capabilities only)
**Researched:** 2026-07-17
**Confidence:** MEDIUM — core protocol and host claims use current official documentation; host-specific lifecycle behavior still needs installed-host verification.

## Product Position

The product is not merely an MCP tool that opens a page. Its public promise is: a person can safely finish a long question round and know whether the initiating agent received it. MCP makes a large set of hosts reachable, but it does **not** guarantee that an in-flight call survives a client timeout, cancellation, or subprocess exit. The MCP specification explicitly allows stdio client shutdown/restart to lose in-flight work and requires cancellation races to be handled gracefully. Therefore, durable recovery and delivery state are table stakes, not optional polish. [MCP stdio transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports), [MCP cancellation pattern](https://modelcontextprotocol.io/specification/draft/basic/patterns/cancellation)

For the existing localhost-only, zero-production-dependency system, make the durable on-disk round record authoritative and keep browser storage as a fast recovery cache. Save as answers change; do not rely on `beforeunload`, `unload`, or a final async IndexedDB write, because browsers may not run those handlers or complete their work. [MDN page-lifecycle guidance](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon), [MDN IndexedDB lifecycle caveat](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB)

## Table Stakes

Features users reasonably expect before trusting this at public-launch scale. Complexity describes product and regression risk, not just code volume.

| Feature | User-visible behavior | Complexity | Dependencies / acceptance evidence |
|---|---|---:|---|
| Durable draft on every meaningful edit | Refreshing, closing/reopening, losing SSE, or restarting the bridge restores the same round, current question, and answers within a documented retention window. The screen says when the draft was last saved. | High | Versioned local round store; stable round identity; atomic writes; browser-cache reconciliation; crash/restart tests. |
| Recovery inbox and deterministic resume | On launch, the user sees recoverable rounds with origin host, age, status, and safe actions: resume, discard, or copy answers. A new round never silently overwrites a recoverable one. | High | Durable status machine; retention/cleanup policy; privacy-conscious metadata; manual restart verification. |
| Explicit lifecycle state | The UI distinguishes `drafting`, `host disconnected`, `waiting to deliver`, `delivered`, `delivery uncertain`, `cancelled`, and `expired`; it never calls an unconfirmed delivery “complete.” | High | Adapter lifecycle contract; durable event journal/state transitions; idempotency keys; all terminal paths tested. |
| Delivery confirmation and retry | After Submit, show “delivering” until the host-facing request acknowledges receipt. If acknowledgement cannot occur, preserve the completed answers and offer retry/copy/recovery rather than closing the tab. Repeating submit must not duplicate or misroute answers. | High | Host correlation/request ID; idempotent answer endpoint; acknowledgement semantics; host-specific integration test. |
| Honest deadline handling | The app identifies which boundary owns a deadline (host, adapter, bridge, browser), avoids product-imposed idle deadlines where unnecessary, and warns early when a host deadline is unavoidable. The user can safely recover a completed draft after it. | High | Timeout-policy capability field per adapter; redacted lifecycle diagnostics; real-host delayed-round tests. Codex exposes per-server startup/tool timeouts, and Claude documents configurable hook/MCP timeout settings. [Codex MCP](https://developers.openai.com/codex/mcp) |
| Browser lifecycle controls | Users can choose browser/open behavior where the platform permits it; see the active/recovery URL; safely reopen it; and choose post-submit behavior. Automatic tab close happens only after delivery confirmation and only when the tab was product-opened; otherwise show a completion state and a close button/instruction. | Medium | Platform opener abstraction; persisted preferences; browser capability/fallback tests. |
| Settings as a public contract | A searchable settings UI groups controls by lifecycle, recovery/retention, browser, accessibility, diagnostics, and host adapters. Every setting has a default, validation, help text, scope, and reset behavior. | High | Single versioned schema shared by UI/Node; migrations; atomic persistence; schema/default/migration tests. |
| Settings portability | Export redacted settings, validate before import, preview changes, keep a backup, and report migration/import errors without silently resetting the user. Do not export drafts or question/answer content by default. | Medium | Schema version; import validator; atomic backup/restore; accessibility tests for errors. W3C requires detected form errors to be identified and described in text. [WCAG error identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html) |
| Host support matrix and support UX | The website and CLI/doctor show `Supported`, `Experimental`, `Researching`, or `Unsupported`, exact versions tested, install steps, config scope, capabilities, known limits, logs/doctor command, and a reason when unsupported. | Medium | Machine-readable adapter manifest; generated docs; installation smoke test; release evidence record. |
| Adapter onboarding gate | Adding a host requires official documentation, config schema, local install/doctor proof, tool-call test, long-round/restart/cancel test, security review, and user-facing limitations. A protocol resemblance alone is insufficient. | High | Adapter contract; evidence template; fixture/harness; release checklist. |
| Accessible recovery and settings flows | Keyboard navigation, focus restoration after reconnect/error, visible text status, live announcement for state changes, labels, and specific validation errors. Review-before-submit remains available. | Medium | Existing a11y baseline plus recovery/settings tests. W3C recommends review/correction/confirmation for submissions and accessible error text. [WAI form validation](https://www.w3.org/WAI/tutorials/forms/validation/) |

### Required settings families

Treat these as one schema with explicit defaults and migrations, not as scattered environment variables:

| Family | Minimum controls | Dependency |
|---|---|---|
| Recovery & retention | draft enabled, retention duration, storage location/status, cleanup policy, clear all recovered rounds | Durable round store and migration strategy |
| Delivery & lifecycle | warn-before-known-deadline, retry behavior, terminal-state detail, redacted diagnostics | Adapter capability data and lifecycle journal |
| Browser | opener/preferred browser, reuse-or-new tab, reopen URL, post-delivery close policy | OS launcher and browser constraints |
| Accessibility & appearance | theme, motion, density, focus/reconnect announcements, keyboard help | Existing UI/theming system |
| Host adapters | enablement, configuration scope guidance, timeout policy, diagnostic/doctor action | Per-host manifest and config writer |
| Import/export/reset | export redacted settings, validate/preview import, backup before migration, reset by family or all | Versioned schema / atomic persistence |

## Differentiators

These make AskUserQuestionsPro meaningfully safer than a conventional prompt or a generic MCP server; they should follow the table stakes rather than replace them.

| Feature | Value proposition | Complexity | Notes |
|---|---|---:|---|
| Delivery receipt timeline | A compact, human-readable trail explains: draft saved → host detached/deadline reached → submitted → host acknowledged, without storing question/answer payloads in logs. | Medium | Makes support actionable and prevents false “completed” UI. |
| Host-aware recovery guidance | Recovery tells the user what can happen next for the originating host: retry tool delivery, resume the agent session, copy a structured answer result, or reopen the browser. | High | Must be generated from tested adapter capabilities, not prose guesses. |
| One-command/on-click host onboarding | Ship an install path only after a host has a documented configuration surface. Prefer the host’s native manager/config and provide a direct verification command. | Medium | Cursor, Kiro, and Copilot have official MCP onboarding/management workflows; use them when supported. [Cursor MCP](https://docs.cursor.com/context/model-context-protocol), [Kiro configuration](https://kiro.dev/docs/cli/mcp/configuration/), [Copilot CLI MCP](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers) |
| Capability cards instead of a logo wall | Each host card shows transport, scopes, approval model, timeout configurability, tested lifecycle scenarios, and limitations. | Medium | Builds public trust and directs implementation order. |
| Privacy-preserving support bundle | The user can export redacted lifecycle metadata, versions, host capability status, and logs; answers/questions stay excluded unless explicitly copied. | Medium | Fits localhost-only safety and makes triage possible. |

## Practical Host Landscape

`Supported` below means an official current documentation surface exists that can plausibly run the **existing stdio MCP adapter**. It is deliberately not a claim that the product already meets Sprint 2 guarantees there. Promote only after the evidence gate passes.

| Host / surface | Official integration evidence | Expected integration behavior | Sprint 2 recommendation |
|---|---|---|---|
| Claude Code | Native hook is already the primary integration; Claude Code also documents MCP/plugin configuration and hook timeout configuration. | Preserve native AskUserQuestion fallback; expose bridge status/recovery without blocking native fallback; validate hook-deadline behavior separately from MCP. | **Supported baseline; harden and live-test.** [Claude Code hooks](https://code.claude.com/docs/en/hooks), [Claude Code MCP](https://code.claude.com/docs/en/mcp) |
| OpenAI Codex CLI / IDE / ChatGPT Desktop | Codex supports local stdio and Streamable HTTP MCP, config/CLI management, and per-server tool/startup timeouts. | MCP `ask` tool; user/global configuration; deadline and cancellation behavior must be tested on actual Codex versions. | **Supported baseline; harden and live-test.** [Codex MCP](https://developers.openai.com/codex/mcp) |
| Cursor IDE and Cursor Agent CLI | Supports stdio, SSE, and Streamable HTTP; project `.cursor/mcp.json` and global `~/.cursor/mcp.json`; tool approval and auto-run controls; CLI uses same MCP config. | stdio adapter should work unchanged; document approvals, config scope, and manual verification in both IDE and CLI. | **Priority experimental candidate.** [Cursor MCP](https://docs.cursor.com/context/model-context-protocol), [Cursor CLI MCP](https://docs.cursor.com/en/cli/using) |
| GitHub Copilot CLI | Official `/mcp add`, `copilot mcp add`, config file and local stdio/HTTP/SSE support; policy/allowlist may block installs. | Use standard stdio package command; provide CLI doctor/list-tools proof and an explicit enterprise-policy explanation. | **Priority experimental candidate.** [Copilot CLI MCP](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers) |
| Gemini CLI | Official `settings.json` MCP configuration and `/mcp list`/reload verification; supports configuration allow/exclude controls. | Standard MCP adapter, but verify actual tool-call deadline and prompt behavior. | **Priority experimental candidate.** [Gemini CLI MCP setup](https://geminicli.com/docs/cli/tutorials/mcp-setup/), [configuration reference](https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md) |
| Amazon Q Developer CLI and IDE | Official stdio/HTTP MCP support, global/workspace config, UI permissions, timeout field, progressive tool loading, and CLI status commands. | Use per-surface config instructions; keep tool permission/timeout guidance explicit. | **Priority experimental candidate.** [Amazon Q MCP](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/qdev-mcp.html), [IDE config](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/mcp-ide.html) |
| Cline (extension and CLI) | Official MCP docs state both extension and CLI use MCP; CLI exposes `mcp`, `doctor`, and a default no-timeout option. | Standard adapter candidate; test default auto-approval, explicit user approval, cancellation, and extension vs CLI config separately. | **Experimental; evidence incomplete.** [Cline MCP overview](https://docs.cline.bot/mcp/mcp-overview), [Cline CLI](https://docs.cline.bot/cli/cli-reference) |
| OpenCode | Official docs state custom tools/MCP servers and permissions; current releases show ongoing MCP lifecycle work. | Standard adapter candidate; verify config scope, stdio transport, and long-running tool behavior from current docs/install. | **Researching — do not advertise yet.** [OpenCode tools](https://opencode.ai/docs/tools/) |
| Kiro IDE / CLI | Official stdio/remote config, agent/workspace/global precedence, statuses, tool permissions, timeouts, and one-click install links. | Good onboarding candidate; document governance fail-closed and automatic/asked approvals. | **Experimental; high-quality evidence path.** [Kiro MCP configuration](https://kiro.dev/docs/cli/mcp/configuration/), [Kiro server directory](https://kiro.dev/docs/mcp/servers/) |
| Kilo Code | Official global/project scopes, stdio/HTTP/SSE configuration, status UI, approvals, configurable timeout; docs disclose one MCP operation at a time. | Standard adapter candidate; test serialized tool-call limitation and configured timeout. | **Experimental; test before claim.** [Kilo MCP](https://kilo.ai/docs/automate/mcp/using-in-kilo-code) |
| Qwen Code | Official `qwen mcp` configuration supports stdio/SSE/Streamable HTTP, timeout, tool allowlist, and trust. | Standard adapter candidate; document confirmation/trust setting, config precedence, and local credential behavior. | **Experimental; test before claim.** [Qwen Code MCP](https://qwenlm.github.io/qwen-code-docs/en/users/features/mcp/) |
| Roo Code | Official project documents and repository indicate MCP use, but this pass did not recover a current authoritative configuration/lifecycle page. | Do not infer compatibility from Cline lineage or extension branding. | **Researching.** Obtain official configuration, install, and long-round proof first. [Roo Code repository](https://github.com/RooCodeInc/Roo-Code) |
| Windsurf | No current official MCP configuration/lifecycle document was verified in this pass. | Do not claim support from editor category or possible VS Code ancestry. | **Researching / unsupported until official evidence path exists.** |
| Aider | No official MCP client/extension surface was verified; its published docs focus on terminal chat/configuration. | A shell wrapper alone cannot supply an in-agent round/result contract safely. | **Unsupported for now; explain lack of verified integration surface.** [Aider docs](https://aider.chat/docs/) |

### What users expect from a supported MCP surface

1. A copy/paste or one-command configuration at the documented user/project scope.
2. A host-native way to see server status and tools; the product docs must point to it.
3. Clear approval expectations: most IDEs prompt by default, and enterprise controls can deny or allowlist servers. Never tell users to blanket auto-approve the bridge.
4. A visible timeout/recovery limitation when the host has a configured or hard deadline.
5. A working uninstall/disable path and a `doctor` result that says exactly what failed.

## Anti-Features

| Anti-feature | Why avoid it | Do instead |
|---|---|---|
| “Universal MCP support” badge | MCP transport compatibility says nothing about tool timeout, cancellation, installation, policy, or long-round evidence. It would overpromise a reliability guarantee. | Publish the evidence-based capability matrix and promote hosts one at a time. |
| Treat browser unload as a save/delivery guarantee | Browser lifecycle callbacks are unreliable and asynchronous persistence may be aborted during shutdown. | Incrementally persist drafts; reconcile on reopen; require server/adapter acknowledgement for delivery. |
| Close the tab immediately on Submit | The user loses the only recovery surface when host delivery races with a deadline or disconnect. | Keep a final receipt/retry state and close only after confirmed delivery and applicable user preference. |
| Blindly increase all timeouts / keepalive traffic | A host watchdog may still terminate the call; hidden deadlines produce false confidence and stranded state. | Attribute deadline ownership, remove only avoidable local limits, and preserve/resume work across unavoidable host limits. |
| Automatic browser selection by probing/executing arbitrary paths | It is fragile, surprising, and can create a local execution/security support burden. | Use OS default by default; offer explicit, validated user selection with a documented fallback. |
| Unversioned settings JSON | Schema changes at public scale become silent resets, invalid settings, or broken installs. | Versioned schema, validated migrations, backup, import preview, and a tested reset path. |
| Exporting answers in settings/support bundles | It breaches the product’s local-privacy expectation and creates an accidental disclosure channel. | Export only redacted diagnostics/settings; separate explicit answer copy/export. |
| Host-specific forks of bridge logic | Reliability fixes diverge and produce inconsistent lifecycle semantics. | Keep one durable round/lifecycle core with narrow adapters and capability declarations. |
| Remote server, accounts, or cloud sync | Changes the security model and is outside the local single-user milestone. | Keep persistence local and bound to `127.0.0.1`; document retention and deletion. |

## Dependencies and Delivery Order

```text
Versioned durable round record
  -> draft autosave + recovery inbox
  -> lifecycle state machine + delivery receipt/idempotency
  -> browser completion/reopen UX
  -> adapter capability contract + diagnostic evidence
  -> supported-host matrix and onboarding documentation

Versioned settings schema
  -> migration/backup/import/export
  -> lifecycle, browser, recovery, and adapter controls
```

**MVP recommendation:**

1. Deliver the durable round record, incremental draft save, recovery inbox, and retention semantics first.
2. Add explicit lifecycle/delivery-receipt states and safe post-submit behavior next, verified through Claude and Codex live paths.
3. Build the versioned settings foundation before exposing the broad controls.
4. Define the adapter contract, then certify Cursor, Copilot CLI, Gemini CLI, and Amazon Q as the first evidence-backed expansion cohort.
5. Add Cline, Kiro, Kilo, Qwen, and OpenCode only through the same gate; retain clear `Researching`/`Unsupported` pages for Roo, Windsurf, Aider, and any host without proof.

**Defer:** universal install buttons, automated browser closing as a default, host-specific persistence formats, and any cloud/multi-user feature. They either weaken the recovery invariant or require host-specific evidence that does not yet exist.

## Research Gaps and Phase-Specific Investigation

| Topic | Gap / risk | Required evidence before implementation or public claim |
|---|---|---|
| Claude Code | Exact behavior of the production native hook under a deliberately long live round; current context notes an unauthenticated prior acceptance environment. | Authenticated acceptance run: idle, refresh, bridge restart, host close, submit/acknowledge. |
| Codex | Exact hard deadline and cancellation behavior varies by client/version/configuration. | Matrix of tested Codex CLI, IDE, and Desktop versions with configured timeout values and recovery results. |
| Candidate MCP hosts | Documentation proves configuration surfaces, not delivery semantics or tool-call survival. | Install, `list/status`, 15-question long round, restart/recovery, cancellation, retry/acknowledgement, uninstall, and policy-blocked tests per host. |
| Roo Code and Windsurf | Current official configuration/lifecycle evidence was not recovered. This is an absence-of-evidence finding, not a proof of impossibility. | Official docs plus a reproducible local test before marking even experimental. |
| Browser automation | Whether a browser/tab can close programmatically depends on how it was opened and browser policy. | Manual macOS/Linux/Windows browser matrix; preserve a visible manual-close fallback. |
| Draft encryption / filesystem permissions | Local persistence satisfies milestone scope but users may have shared-machine privacy needs. | Product decision on storage location, permissions, and optional encryption; do not imply encryption until designed/tested. |

## Sources

- **MEDIUM confidence, official/specification:** [Model Context Protocol stdio transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports), [cancellation](https://modelcontextprotocol.io/specification/draft/basic/patterns/cancellation), [security best practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices)
- **MEDIUM confidence, official host documentation:** [OpenAI Codex MCP](https://developers.openai.com/codex/mcp), [Cursor MCP](https://docs.cursor.com/context/model-context-protocol), [GitHub Copilot CLI MCP](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers), [Gemini CLI MCP](https://geminicli.com/docs/cli/tutorials/mcp-setup/), [Amazon Q MCP](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/qdev-mcp.html), [Cline MCP](https://docs.cline.bot/mcp/mcp-overview), [Kiro MCP](https://kiro.dev/docs/cli/mcp/configuration/), [Kilo MCP](https://kilo.ai/docs/automate/mcp/using-in-kilo-code), [Qwen Code MCP](https://qwenlm.github.io/qwen-code-docs/en/users/features/mcp/), [OpenCode tools](https://opencode.ai/docs/tools/)
- **MEDIUM confidence, platform/standards documentation:** [MDN sendBeacon and lifecycle guidance](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon), [MDN IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB), [W3C form validation](https://www.w3.org/WAI/tutorials/forms/validation/), [WCAG error identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html)
