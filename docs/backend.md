# Backend

Everything Node-side: the bridge server, the shared client, the hook, the MCP
server, the CLI, and install. Zero npm dependencies — Node core only.

## Bridge server (`server/server.js`)

`node:http` server. Port from `ASKUSER_PORT` (default `4517`); serves static
files from `../web`. Exports `server` and `bridge` (a shared `Bridge`
instance).

Responsibilities:

- Route the HTTP endpoints (see [api.md](api.md)).
- Maintain `sseClients` (a `Set`) and `broadcastCurrent()` → push
  `bridge.peek()` to every SSE client whenever state changes. Each
  `res.write()` is wrapped in try/catch; failed writes remove the dead
  client from `sseClients`.
- `validQuestions()` validates incoming question arrays.
- `readBody()` reads request bodies with an 8 MB cap (tracked by byte count, not character count; `req.destroy()` on overflow).
- On client disconnect during an open `/ask`, call `bridge.cancel()` so the
  bridge isn't left blocked.
- Path-traversal-safe static serving (resolved paths must stay under `web/`).
- When serving `index.html`, inject `<script>window.__ASKUSER_SETTINGS__=…</script>`
  before `</head>` so the persisted settings (`Settings.read()`) are present
  before the app boots (no theme/scale flash).
- `POST /settings` — accepts a JSON object patch, writes it via
  `Settings.write()` (schema-validated), returns `{ ok, settings }`.

## Bridge (`server/bridge.js`)

The single-flight coordinator. State: `_pending` (`{id, questions, resolve,
reject}` or `null`) and `_seq` (monotonic counter for ids).

| Method                       | Behavior                                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `submitQuestions(questions)` | Stores a new pending set, returns a Promise that resolves on answers. **Throws if one is already pending.** |
| `peek()`                     | `{ id, questions }` or `null` — side-effect free.                                                           |
| `getCurrent()`               | Just the questions array (or `null`).                                                                       |
| `provideAnswers(answers)`    | Resolves the pending promise, clears `_pending`, returns `true`.                                            |
| `cancel(reason)`             | Rejects the pending promise, clears `_pending`.                                                             |

## Shared client (`lib/bridge-client.mjs`)

Used by both the hook and the MCP server. Port/base from `ASKUSER_PORT`
(default `4517`), base `http://127.0.0.1:${PORT}`.

- `ensureServer()` — `GET /health`; if down, spawn `server/server.js`
  detached and poll up to 30×100ms; returns whether it came up.
- `openBrowser()` — OS opener: `open` (macOS), `cmd /c start` (Windows),
  `xdg-open` (Linux), pointed at the base URL. Silent on failure.
- `askBridge(questions, { timeoutMs })` — `POST /ask`; returns the answers
  object or throws. Uses `AbortController` for the timeout.

## Settings persistence (`lib/settings.js` + `web/settings-schema.js`)

`web/settings-schema.js` is a UMD module (browser global `Settings_Schema`,
also `require`-able by Node) holding the **single source of truth** for UI
settings: `theme`, `uiScale`, `reduceMotion`. It exposes
`entries/byKey/defaults/groups/validate/coerce/applyAll`. `validate()` is
self-healing — unknown keys dropped, invalid/missing values replaced with
defaults, never throws. `apply()` functions run only in the browser.

`lib/settings.js` is the disk layer (consumed by `server/server.js` and
`bin/cli.js`):

- File: `${XDG_CONFIG_HOME or ~/.config}/askuserquestionspro/settings.json`.
- `read()` — parse the file and `Schema.validate()` it; ENOENT or corrupt JSON
  both fall back to schema defaults (never throws).
- `write(patch)` — merge over current, validate, then atomic write
  (`.tmp` + `rename`); stamps `_v: 1`. Returns the written object.
- `getPath()` — the resolved file path.

## Hook (`hooks/askuserquestionspro-bridge.mjs` + `hooks/hook-output.js`)

The `PreToolUse` interceptor for native `AskUserQuestion` (≤4 questions).
Executable `.mjs`. Flow:

1. Read JSON from stdin; expect `input.tool_input.questions`.
2. If `ASKUI_FORCE_MCP` is set → **deny** the native call with a reason telling
   Claude to use `mcp__askuserquestionspro__ask` instead. (Opt-in: always use
   the unlimited MCP path.)
3. `ensureServer()` → `openBrowser()` → `askBridge(questions, {timeoutMs: 60
min})`.
4. Wrap answers with `buildHookOutput()` and write to stdout.

Fallback: any error / uncaught exception → `process.exit(0)`, letting Claude
Code use its native picker. Never blocks.

`buildHookOutput(toolInput, answers)` filters `answers` to only keys that
match a question in `toolInput.questions` (prevents stale/extra keys reaching
Claude), then returns:

```js
{
  suppressOutput: true,
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'allow',
    permissionDecisionReason: 'Answered via custom AskUserQuestion UI',
    updatedInput: { questions: toolInput.questions, answers }
  }
}
```

## MCP server (`mcp-server/askuserquestionspro-mcp.mjs`)

JSON-RPC 2.0 over stdio (STDOUT = protocol, STDERR = logs). Zero deps.
Exposes one tool, `ask` (full name `mcp__askuserquestionspro__ask`) — the
**unlimited-questions** path.

Methods: `initialize`, `tools/list`, `tools/call`, `ping`. Notifications
(`id === undefined`) are logged and ignored. Reads line-delimited JSON from
STDIN, buffering partial lines. On STDIN `end`, any trailing buffered line is
flushed and attempted to parse; JSON parse errors there are logged to STDERR
(not silently swallowed).

`handleAsk(args)` imports `ensureServer/openBrowser/askBridge` from
`lib/bridge-client.mjs`, ensures the server, opens the browser, and calls
`askBridge(questions, {timeoutMs: 60 min})`. Returns answers as JSON text.
Server-down / timeout / cancel → a fallback message suggesting the built-in
tool. All-skipped → `{ answers: {} }`.

Tool input schema: see [api.md](api.md).

## CLI (`bin/cli.js` + `bin/install.js`)

`bin/cli.js` — executable `askuserquestionspro`. Subcommands:

| Command     | What it does                                                                                                                                                                                                                 |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `init`      | Alias for `install`.                                                                                                                                                                                                         |
| `install`   | Register the `PreToolUse` hook in `~/.claude/settings.json` and register the MCP server via `claude mcp add --scope user askuserquestionspro -- node <mcp>`.                                                                 |
| `uninstall` | Remove the hook entry from settings.                                                                                                                                                                                         |
| `serve`     | Run `server/server.js` in foreground (debug).                                                                                                                                                                                |
| `mcp`       | Run the MCP stdio server in foreground (debug).                                                                                                                                                                              |
| `settings`  | `settings` / `settings list` prints all entries + the config file path; `settings get <key>` prints one value; `settings set <key> <val>` coerces + writes via `lib/settings.js` (unknown key / invalid value → error exit). |
| `doctor`    | Health check: hook present, hook file exists, bridge server reachable, MCP registered, settings file status (`_v` + resolved values, or defaults if missing/corrupt).                                                        |
| `help`      | Usage.                                                                                                                                                                                                                       |

`bin/install.js` — pure settings manipulation (testable):

- `addHook(settings, hookAbsPath)` → `{ settings, status }` where status is
  `added` / `already` / `conflict` (conflict = another `AskUserQuestion` hook
  already present).
- `removeHook(settings, hookAbsPath)` → status `removed` / `absent`.
- `readSettings(settingsPath)` → parsed object. ENOENT → returns `{}` (file
  not yet created is normal). Other read errors or invalid JSON → throws loudly
  so the caller isn't silently working from a corrupt baseline.
- `writeSettings(settingsPath, settings)` → atomic write (mkdir -p + writeFile).
- Hook entry: `matcher: 'AskUserQuestion'`, command `node "<hookAbsPath>"`,
  `timeout: 3600`.

## Install script (`install.sh`)

`curl | bash`-friendly. Downloads/extracts the repo if needed, copies
`hooks/ web/ server/ lib/ mcp-server/` to
`~/.local/share/askuserquestionspro/`, ensures `~/.claude/settings.json`,
idempotently registers the hook via `jq` (or prints manual steps), and
registers the MCP server (`claude mcp remove` then `claude mcp add --scope
user ...`).

## Clean reinstall script (`reinstall.sh`)

Idempotent, `set -uo pipefail`. Steps: (1) kill any running bridge process on
`ASKUSER_PORT` (default 4517) — sends SIGTERM, waits up to 10×100ms, then
SIGKILL if still alive; (2) remove `~/.local/share/askuserquestionspro/`,
`~/.config/askuserquestionspro/` (UI settings), and the hook+MCP registration;
(3) clone the repo fresh from GitHub and re-run `install.sh`. Use this to
recover from a corrupted install or to pick up a breaking-change update.
