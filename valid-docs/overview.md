# Overview

## What it is

`askuserquestionspro` is a Node.js tool (npm package + CLI) that intercepts
Claude Code's `AskUserQuestion` interactions and answers them through a custom,
themeable, full-screen web UI running on `127.0.0.1` — instead of the terminal
picker built into Claude Code.

It solves two problems:

1. **Better UX.** The built-in picker is cramped. This renders questions in a
   keyboard-driven browser UI (AMOLED default + 4 alternate themes).
2. **The 4-question limit.** Claude Code's built-in `AskUserQuestion` tool
   rejects more than 4 questions per call (`InputValidationError`). The MCP
   tool `mcp__askuserquestionspro__ask` accepts an **unlimited** number of
   questions in one call and routes them through the same UI.

## The 30-second mental model

There are two entry paths into the same UI:

- **Hook path** — for native `AskUserQuestion` calls (≤4 questions). A
  `PreToolUse` hook registered in `~/.claude/settings.json` intercepts the
  call, opens the UI, and returns the user's answers as `updatedInput`. On any
  failure it exits cleanly and lets Claude Code fall back to the native picker.
- **MCP path** — for unlimited questions. Claude calls
  `mcp__askuserquestionspro__ask`, which opens the same UI and returns answers
  as the tool result.

Both paths funnel through a tiny local HTTP **bridge server** (port `4517` by
default) that holds at most one pending question set in memory and pushes it to
the browser over Server-Sent Events. The browser POSTs answers back; the
server resolves the waiting promise; the hook/MCP returns.

```
Claude Code
  ├─(≤4 native)→ hook ─┐
  └─(unlimited)→ MCP ──┤── lib/bridge-client → HTTP → bridge server ⇄ SSE ⇄ web UI (browser)
```

## Who it's for

Claude Code users who want a nicer, larger question interface and the ability
to ask many questions at once. Install is `npx askuserquestionspro init` (or
`install.sh`), which registers the hook and the MCP server.

## Key properties

- **Zero runtime dependencies** — Node core only (no npm `dependencies`).
- **Graceful degradation** — every failure mode falls back to Claude Code's
  native behavior; the tool never blocks the user.
- **Single-flight** — exactly one question set is in play at a time.
- **In-memory only** — no database; answers live in RAM until delivered.
