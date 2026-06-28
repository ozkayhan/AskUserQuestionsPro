# valid-docs — askuserquestionspro

> **Synced to:** `18b634f` — 2026-06-28
> Regenerate/refresh with the `update-docs` skill. These docs describe the
> codebase at the commit above; if HEAD has moved, re-run to reconcile.

Read this folder before exploring the source — it maps the whole codebase.

## What this is

A zero-dependency tool that replaces Claude Code's built-in `AskUserQuestion`
picker with a local, full-screen web UI, and adds an MCP tool
(`mcp__askuserquestionspro__ask`) that supports **unlimited** questions per
call (the built-in tool caps at 4). Four moving parts: **hook** (for native
≤4-question calls) → **MCP server** (for unlimited questions) → **bridge
server** (in-RAM question/answer relay) → **web UI**. The hook and MCP server
share `lib/bridge-client.mjs`.

## Documents

- [overview.md](overview.md) — what this project is and the 30-second model
- [tech-stack.md](tech-stack.md) — languages, runtimes, tooling, dependencies
- [architecture.md](architecture.md) — components, data flow, design decisions
- [code-map.md](code-map.md) — where everything lives (start here to navigate)
- [frontend.md](frontend.md) — web UI: React-via-Babel app, views, themes, answer logic
- [backend.md](backend.md) — bridge server, hook, MCP server, CLI, install
- [api.md](api.md) — HTTP endpoints, MCP tool contract, hook I/O shapes
- [testing.md](testing.md) — test suite layout and how to run it
- [hardening.md](hardening.md) — 5-theme systemic hardening sprint: what was changed, why, and the CI guards

## Note on existing in-repo docs

`docs/` (this folder) is the English, code-verified canonical reference for
agents. The `design-reference/` tree was removed in commit `1e1da06` (PR #13).
`docs/hardening.md` records the 5-theme systemic hardening applied to the codebase.
