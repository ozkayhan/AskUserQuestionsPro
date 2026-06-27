# valid-docs — askuserquestionspro

> **Synced to:** `e7c5b6a` — 2026-06-27
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

## Note on existing in-repo docs

The repo also ships Turkish-language docs (`CODEMAP.md`, `living_docs/`).
`valid-docs/` is the English, code-verified equivalent and is the canonical
map for agents. The `design-reference/` tree is a historical design/spec
artifact, not a current-behavior reference.
