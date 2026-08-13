# docs — askuserquestionspro

Read this folder before exploring the source — it maps the whole codebase.

## What this is

A zero-runtime-dependency, host-neutral question/answer core with adapters for
Claude Code, Codex CLI, Antigravity CLI, and the Codex surface in ChatGPT Desktop. Claude Code
can use a `PreToolUse` hook for native `AskUserQuestion`; every host can use the
unlimited `mcp__askuserquestionspro__ask` tool plus the installed `askpro`
skill. Codex hooks cannot return answers as the native `request_user_input`
result, so its integration is MCP + skill guidance rather than native result
replacement. Both entry paths share `lib/bridge-client.mjs`, the localhost
bridge, and the browser UI.

## Documents

- [overview.md](overview.md) — product scope, host adapters, and core flow
- [tech-stack.md](tech-stack.md) — languages, runtimes, tooling, dependencies
- [architecture.md](architecture.md) — components, data flow, design decisions
- [decisions.md](decisions.md) — maintained architecture and reliability decisions with provenance
- [code-map.md](code-map.md) — where everything lives (start here to navigate)
- [frontend.md](frontend.md) — web UI: React-via-Babel app, views, themes, answer logic
- [backend.md](backend.md) — bridge server, hook, MCP server, CLI, install
- [hosts.md](hosts.md) — Codex/Claude lifecycle contracts, fallbacks, and host-boundary evidence
- [host matrix](https://github.com/ozkayhan/AskUserQuestionsPro/blob/main/test/host-compatibility-evidence.md) and [capability cards](host-capability-cards/) — evidence-gated compatibility states
- [host research gates](host-research/README.md) — dated sources and isolated installed-host handoff
- [cross-platform evidence](evidence/phase-13-cross-platform.md) and [native OS handoff](evidence/phase-13-native-os-runs.md) — release limitations and required lanes
- [timeout-runbook.md](timeout-runbook.md) — long-round reproduction, lifecycle interpretation, and recovery
- [api.md](api.md) — HTTP endpoints, MCP tool contract, hook I/O shapes
- [testing.md](testing.md) — test suite layout and how to run it
- [release.md](release.md) — canonical GitHub Actions/npm publishing path and release guardrails
- [hardening.md](hardening.md) — 5-theme systemic hardening sprint: what was changed, why, and the CI guards
- [maintenance.md](maintenance.md) — documentation ownership, naming, archive, and verification rules
- [release evidence handoff](evidence/v1.1.1-release-handoff.md) — current bounded UAT, security, quality, and external-release evidence
- [archive/README.md](archive/README.md) — historical reports and plans retained for provenance

## Note on existing in-repo docs

`docs/` (this folder) is the English, code-verified canonical reference for
contributors and maintainers. Historical audit and workflow material lives
under `docs/archive/` and is not an active implementation plan. The public
README links to these pages using stable GitHub paths where a package install
cannot resolve repository-relative test or documentation links.
