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
  `bridge.peek()` to every SSE client whenever state changes. Dead-write
  guard: checks `res.writable` before writing; the `/events` `close` listener
  removes the client (no zombie accumulation).
- `validQuestions()` — single validation authority for incoming question
  arrays. Validates types, field constraints, option label lengths (1–500
  chars via `validLabel()`), and performs **recursive** tree-node label
  checking (`checkTreeNodes`) so nested labels at any depth are validated,
  not just top-level ones.
- `readBody()` reads request bodies with an 8 MB cap (tracked by byte count;
  `req.destroy()` on overflow; single-settle guard prevents double
  reject/resolve on the concurrent `data`/`close`/`error` race).
- On client disconnect during an open `/ask`, call `bridge.cancel('client
disconnected', myId)` where `myId` is the round id captured at submit time
  (Contract R — only the owning round is cancelled, not a concurrently
  submitted new one).
- `POST /answer` parses `{ id, answers }`. Validates
  `!answers || typeof answers !== 'object' || Array.isArray(answers)` → 400
  (plain object required); then `bridge.provideAnswers(id, answers)` → 409 on
  id mismatch (Contract R). Responds `{ ok: true }` on success.
- Path-traversal-safe static serving (resolved paths must stay under `web/`).
  Non-index assets served with a weak DJB2 ETag for browser cache revalidation
  (304 on match); index.html gets no ETag (settings injection varies per
  request).
- When serving `index.html`, inject `<script>window.__ASKUSER_SETTINGS__=…</script>`
  before `</head>` so the persisted settings (`Settings.read()`) are present
  before the app boots (no theme/scale flash). Settings are memory-cached
  (`settingsCache`) and invalidated on `POST /settings` to avoid repeated disk
  reads.
- `POST /settings` — accepts a JSON object patch, writes it via
  `Settings.write()` (schema-validated, Contract W). On disk-write failure
  returns HTTP 500 (not a silent fake success). Strips `_v` from the response.
- `GET /health` responds `{ ok: true, app: APP_ID }` — the `app` field lets
  the client verify it is talking to this server, not a stale or foreign
  process on the same port.
- `server.requestTimeout = 0` — disables Node's default 5-minute request
  timeout so long `/ask` waits (up to 1 hour) are never server-side cut off;
  the real deadline is managed by the client's `AbortController`.
- `server.on('error')` — EADDRINUSE → `exit(0)` (silent, expected race on
  daemon spawn); other errors → `log('server', e)` + `exit(1)` (no silent
  orphan).

## Bridge (`server/bridge.js`)

The single-flight coordinator. State: `_pending` (`{id, questions, resolve,
reject}` or `null`) and `_seq` (monotonic counter for ids).

| Method                        | Behavior                                                                                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `submitQuestions(questions)`  | Stores a new pending set, returns a Promise that resolves on answers. **Throws if one is already pending.**                                         |
| `peek()`                      | `{ id, questions }` or `null` — side-effect free.                                                                                                   |
| `getCurrent()`                | Just the questions array (or `null`).                                                                                                               |
| `provideAnswers(id, answers)` | **Contract R:** resolves only if `id` matches the current pending round's id. Returns `true` on resolve, `false` on mismatch/no pending (no throw). |
| `cancel(reason, expectedId?)` | **Contract R:** rejects the pending promise only if `expectedId` is absent or matches. Returns `true` on cancel, `false` on mismatch/no pending.    |

Round identity (`_seq` monotonically incremented) is the mechanism that makes
cross-round answer mix-up structurally impossible: a late `/answer` carrying
the previous round's id is rejected by `provideAnswers` before it can silently
resolve the new round.

## Shared client (`lib/bridge-client.mjs`)

Used by both the hook and the MCP server. Port/base from `ASKUSER_PORT`
(default `4517`), base `http://127.0.0.1:${PORT}`.

- `ensureServer()` — `GET /health` checking both `ok: true` and `app === APP_ID`
  (identity check prevents a foreign process on the same port from being
  accepted). If down, spawns `server/server.js` detached and polls up to
  30×100ms. Single-flight: concurrent callers share one spawn via the
  `inflight` promise. Spawn errors (ENOENT, permission) are surfaced via
  `log('bridge', e)` instead of silently swallowed.
- `waitForPending({ timeoutMs?, intervalMs? })` — polls `GET /current` until
  `body.id != null` or the deadline passes. Used by the hook to delay
  `openBrowser()` until the round is registered server-side (race guard).
- `openBrowser()` — OS opener: `open` (macOS), `cmd /c start` (Windows),
  `xdg-open` (Linux), pointed at the base URL. Errors reported via
  `log('browser', e)`.
- `askBridge(questions, { timeoutMs })` — `POST /ask`; returns the answers
  array or throws. Uses `AbortController` for the timeout. Abort → typed
  `TimeoutError` (distinguishable from network / HTTP errors by callers).
  JSON parse failure on the response → descriptive Error (not silent).
- `TimeoutError` — exported class; `name === 'TimeoutError'`; thrown only on
  `AbortController` timeout (not on HTTP errors or JSON failures).

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
  both fall back to schema defaults (never throws). Output is schema-shaped
  only (`_v` is dropped — it is a disk-format detail, not part of the public
  read contract).
- `write(patch)` — merge over current, validate, then atomic write via
  `writeFileAtomic` from `lib/atomic-write.cjs` (`.tmp.<pid>` + `rename` +
  `O_EXCL` lockfile); stamps `_v: 1`. **Contract W:** returns
  `{ ok: true, value: next }` on success or `{ ok: false, value: next, error: e }`
  on disk failure (never swallows the error silently). Callers check `ok`
  before trusting the write.
- `getPath()` — the resolved file path.

### Atomic write helper (`lib/atomic-write.cjs`)

`writeFileAtomic(file, data)` — writes data to `file.tmp.<pid>`, then
`rename`s it into place (POSIX-atomic). An `O_EXCL` lockfile (`file.lock`)
serialises concurrent writers: a second writer fails fast with an error rather
than racing to `rename`. Stale locks older than 10 s are reclaimed (handles
killed writers). Orphan `.tmp` files are cleaned up on failure. Consumed by
`lib/settings.js` and `bin/install.js`.

## Hook (`hooks/askuserquestionspro-bridge.mjs` + `hooks/hook-output.js`)

The `PreToolUse` interceptor for native `AskUserQuestion` (≤4 questions).
Executable `.mjs`. Flow:

1. Read JSON from stdin; expect `input.tool_input.questions`.
2. If `ASKUI_FORCE_MCP` is set → **deny** the native call with a reason telling
   Claude to use `mcp__askuserquestionspro__ask` instead. (Opt-in: always use
   the unlimited MCP path.)
3. `ensureServer()` → `waitForPending()` (polls `/current` until the round
   appears; prevents opening the browser before the question is registered) →
   `openBrowser()` → `askBridge(questions, {timeoutMs: 60 min})`.
4. Wrap answers with `buildHookOutput()` and write to stdout via
   `writeAndExit()` (flushes stdout before exiting to avoid EPIPE truncation).

Fallback: any error / uncaught exception → `log('hook', err)` + `process.exit(0)`,
letting Claude Code use its native picker. Never blocks. Both
`uncaughtException` and `unhandledRejection` are handled this way.

`readStdin()` has a 30-second watchdog: if stdin never closes (parent keeps
the write end open), the promise resolves with an empty string → JSON parse
fails → `exit(0)` fallback (no infinite hang).

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

## Structured logger (`lib/log.cjs`)

**Contract L:** `log(scope, x)` writes `[askuser:<scope>] <stack-or-message>\n`
to stderr. Never throws. Used at every former `catch {}` silent-swallow site
(hook uncaught handlers, browser-open error, spawn error in `ensureServer`,
settings write failure, server fatal). Replaces ad-hoc or missing error
reporting with a single consistent output line.

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

Shell hardening applied: uses `WORKDIR` (not `TMPDIR`) to avoid shadowing the
env var; single-quotes the `trap` argument; validates the `jq` output with
`jq -e` before `mv` (corrupt output never clobbers the live settings file);
intent-based idempotent hook deduplication (removes any existing
`askuserquestionspro` PreToolUse entry before re-adding, matching on the
command string rather than exact object equality).

## Clean reinstall script (`reinstall.sh`)

Idempotent, `set -uo pipefail`. Steps: (1) kill any running bridge process on
`ASKUSER_PORT` (default 4517) — sends SIGTERM, waits up to 10×100ms, then
SIGKILL if still alive; (2) remove `~/.local/share/askuserquestionspro/`,
`~/.config/askuserquestionspro/` (UI settings), and the hook+MCP registration;
(3) clone the repo fresh from GitHub and re-run `install.sh`. Use this to
recover from a corrupted install or to pick up a breaking-change update.
