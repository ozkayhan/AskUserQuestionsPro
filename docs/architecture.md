# Architecture

## Components

Four cooperating runtime pieces plus host adapters and a shared client:

| Component          | File(s)                                                         | Role                                                                               |
| ------------------ | --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Claude hook**    | `hooks/askuserquestionspro-bridge.mjs`, `hooks/hook-output.js`  | Claude-only `PreToolUse` interceptor for native `AskUserQuestion` calls.           |
| **MCP server**     | `mcp-server/askuserquestionspro-mcp.mjs`                        | Host-neutral `ask` tool used by Claude Code, Codex CLI, and ChatGPT Desktop.       |
| **Bridge server**  | `server/server.js`, `server/bridge.js`                          | Local HTTP server; holds one pending question set, serves the UI, streams via SSE. |
| **Web UI**         | `web/*`                                                         | Browser app where the user answers.                                                |
| **Shared client**  | `lib/bridge-client.mjs`                                         | Used by both hook and MCP: starts the server, opens the browser, POSTs questions.  |
| **Host installer** | `lib/host-platforms.cjs`, `bin/cli.js`, `skill/askpro/SKILL.md` | Selects Claude/Codex, registers MCP, and deploys host-native skill guidance.       |

## Data flow

```
                    ┌─────────────────────── lib/bridge-client.mjs ───────────────────────┐
                    │  ensureServer()  askBridge()  waitForPending()  openBrowser()       │
                    └──────────────────────────────────────────────────────────────────────┘
                              ▲                                          │
  Claude Code native ── hook ─────────┐                                  │ POST /ask
  Claude / Codex / Desktop ── MCP ────┘                                  ▼
                                                          server/server.js  (port 4517)
                                                          server/bridge.js  (_pending, single-flight)
                                                                  │  ▲
                                                       SSE /events │  │ POST /answer
                                                                  ▼  │
                                                            web UI (browser)
```

Step by step (both entry paths are identical after `bridge-client`):

1. The Claude hook receives stdin JSON, or any supported host sends an MCP
   `tools/call` for `ask`.
2. `ensureServer()` checks `GET /health`; if down, spawns `server/server.js`
   detached and polls for up to ~3s.
3. `askBridge()` starts `POST /ask` with the questions. `waitForPending()`
   polls `/current`; only after the server exposes the new round does
   `openBrowser()` open `http://127.0.0.1:4517`. This ordering prevents a
   transient empty browser state.
4. The `/ask` request stays open until answered or the application's one-hour
   `AbortController` deadline. `server.requestTimeout = 0` prevents Node from
   applying a separate server-side request deadline. Host MCP timeout defaults
   are separate and are not assumed here.
5. `server.js` validates and calls `bridge.submitQuestions()`, which stores
   `{id, questions, resolve, reject}` and returns a promise. The server
   broadcasts the new state to all SSE clients via `broadcastCurrent()`.
6. The browser (connected to `GET /events`) renders the questions, the user
   answers, and the UI does `POST /answer` with `{id, answers}`.
7. `server.js` calls `bridge.provideAnswers(id, answers)`, resolving the promise; the
   open `/ask` request returns the answers.
8. Hook wraps answers via `buildHookOutput()` and writes the `PreToolUse`
   response to stdout; MCP returns answers as tool-result JSON.

## Key design decisions

- **Single-flight bridge.** `Bridge` (`server/bridge.js`) holds at most one
  `_pending` set. `submitQuestions()` throws if one is already pending. This
  keeps the model simple: one browser tab, one question set, one waiting
  caller. `_seq` gives each set a monotonic id so the UI can detect changes.

- **Long-poll over `/ask`, push over SSE.** The caller's HTTP request is the
  synchronization primitive — it blocks until `provideAnswers`/`cancel`. SSE
  (`/events`) is only for pushing state _to_ the browser. This avoids any
  client-side polling loop and any shared state beyond the bridge.

- **Host-native fallback.** The hook exits `0` on errors or empty answers so
  Claude can show `AskUserQuestion`. MCP failures return `isError` guidance to
  use `request_user_input` in Codex or `AskUserQuestion` in Claude Code.

- **Two entry paths, one host-neutral core.** Claude can return answers through
  its native tool's hook contract. Claude and Codex can both call the unlimited
  MCP `ask` tool. Codex hooks can observe, block, or rewrite
  `request_user_input` input but cannot return the user's answers as that
  tool's result, so its `askpro` skill guides tool choice. Both executable paths
  reuse `lib/bridge-client.mjs`.

- **Zero deps, no build step.** React/Babel are vendored and JSX is compiled
  in the browser. The server is raw `node:http`. This keeps install trivial
  (`npx` / `curl | bash`) and the package self-contained.

- **In-memory, localhost-only.** Bound to `127.0.0.1`; answers exist only for
  the lifetime of the pending request. The one persisted thing is UI settings —
  a small JSON file in `~/.config/askuserquestionspro/` (`lib/settings.js`),
  not question/answer data.

## Failure & edge handling

- Client disconnects mid-`/ask` → server calls `bridge.cancel()` so the next
  caller isn't blocked.
- `readBody()` enforces an 8 MB request cap.
- Static file serving in `server.js` guards against path traversal outside
  `web/`.
- SSE sends a keepalive ping (~25s) to keep connections alive.
