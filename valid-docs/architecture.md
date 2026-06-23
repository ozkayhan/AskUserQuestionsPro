# Architecture

## Components

Four cooperating pieces plus a shared client library:

| Component | File(s) | Role |
|-----------|---------|------|
| **Hook** | `hooks/askuserquestionspro-bridge.mjs`, `hooks/hook-output.js` | `PreToolUse` interceptor for native `AskUserQuestion` calls (≤4 questions). |
| **MCP server** | `mcp-server/askuserquestionspro-mcp.mjs` | Exposes the `ask` tool (`mcp__askuserquestionspro__ask`) for unlimited questions. |
| **Bridge server** | `server/server.js`, `server/bridge.js` | Local HTTP server; holds one pending question set, serves the UI, streams via SSE. |
| **Web UI** | `web/*` | Browser app where the user answers. |
| **Shared client** | `lib/bridge-client.mjs` | Used by both hook and MCP: starts the server, opens the browser, POSTs questions. |

## Data flow

```
                    ┌─────────────────────── lib/bridge-client.mjs ───────────────────────┐
                    │  ensureServer()  openBrowser()  askBridge(questions, {timeoutMs})    │
                    └──────────────────────────────────────────────────────────────────────┘
                              ▲                                          │
  Claude Code (≤4 native) ── hook ──┐                                   │ POST /ask
  Claude Code (unlimited) ── MCP ───┘                                   ▼
                                                          server/server.js  (port 4517)
                                                          server/bridge.js  (_pending, single-flight)
                                                                  │  ▲
                                                       SSE /events │  │ POST /answer
                                                                  ▼  │
                                                            web UI (browser)
```

Step by step (both entry paths are identical after `bridge-client`):

1. Hook receives stdin JSON, or MCP receives a `tools/call` for `ask`.
2. `ensureServer()` checks `GET /health`; if down, spawns `server/server.js`
   detached and polls for up to ~3s.
3. `openBrowser()` opens `http://127.0.0.1:4517` with the OS opener.
4. `askBridge()` does `POST /ask` with the questions; the request **stays open**
   until answered or timed out (hook: 5 min; MCP: 30 min).
5. `server.js` validates and calls `bridge.submitQuestions()`, which stores
   `{id, questions, resolve, reject}` and returns a promise. The server
   broadcasts the new state to all SSE clients via `broadcastCurrent()`.
6. The browser (connected to `GET /events`) renders the questions, the user
   answers, and the UI does `POST /answer` with `{answers}`.
7. `server.js` calls `bridge.provideAnswers()`, resolving the promise; the
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
  (`/events`) is only for pushing state *to* the browser. This avoids any
  client-side polling loop and any shared state beyond the bridge.

- **Graceful fallback everywhere.** The hook exits `0` (allowing Claude's
  native picker) on *any* error — server won't start, timeout, no answers,
  uncaught exception. The MCP tool returns a message telling Claude to use the
  built-in tool. The tool is never a hard dependency in the user's flow.

- **Two entry paths, one core.** The 4-question limit lives in Claude Code's
  built-in tool, not here. The hook handles the native (≤4) path; the MCP
  `ask` tool exists purely to bypass that limit with unlimited questions. Both
  reuse `lib/bridge-client.mjs` so behavior is identical.

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
