# Backend

Everything Node-side: the host-neutral bridge/server core, the Claude hook,
the shared MCP server, host adapters, CLI, and installers. Zero runtime npm
dependencies — Node core only.

## Bridge server (`server/server.js`)

`node:http` server. Port from `ASKUSER_PORT` (default `4517`); serves static
files from `../web`. Exports `server` and `bridge` (a shared `Bridge`
instance) and composes the authoritative per-round `RoundStore`.

Responsibilities:

- Compose the HTTP endpoint modules (see [api.md](api.md)), static serving,
  `/health`, and the request-error boundary.
- `server/round-routes.cjs` owns active-round, recovery, and SSE routes,
  including its `sseClients` set and `broadcastCurrent()` dead-write/close
  cleanup.
- `server/settings-routes.cjs` owns settings cache state plus settings export,
  doctor, preview, apply, and reset routes.
- `server/http-io.cjs` provides the shared JSON response and bounded body-read
  helpers used by the route modules.
- `validQuestions()` — single validation authority for incoming question
  arrays. Validates types, field constraints, option label lengths (1–500
  chars via `validLabel()`), and performs **recursive** tree-node label
  checking (`checkTreeNodes`) so nested labels at any depth are validated,
  not just top-level ones.
- On a requestId-bearing client disconnect during an open `/ask`, call
  `bridge.detach('host disconnected', myId)` where `myId` is the round id
  captured at submit time. The browser round remains available to `/resume`
  for the bounded detached TTL. Requests without a requestId retain
  `bridge.cancel('client disconnected', myId)` (Contract R).
- `POST /resume` waits on a detached round, or returns its short-lived cached
  answer if the browser submitted just before the new host connected. Closing
  the `/resume` response removes only that waiter; it never cancels the browser
  round.
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
  before the app boots (no theme/scale flash). The settings route module owns
  the memory cache and invalidates it after successful mutation.
- `POST /settings` — accepts a JSON object patch, writes it via
  `Settings.write()` (schema-validated, Contract W). On disk-write failure
  returns HTTP 500 (not a silent fake success). Strips `_v` from the response.
- `GET /health` responds `{ ok: true, app: APP_ID }` — the `app` field lets
  the client verify it is talking to this server, not a stale or foreign
  process on the same port.
- `server.requestTimeout = 0` — disables Node's server-side request deadline;
  the application deadline is the client's one-hour `AbortController`. A
  host may impose a separate MCP timeout. RequestId-bearing host disconnects
  are therefore detached and resumable instead of being treated as completed
  cancellation.
- `server.on('error')` — EADDRINUSE → `exit(0)` (silent, expected race on
  daemon spawn); other errors → `log('server', e)` + `exit(1)` (no silent
  orphan).

## Bridge (`server/bridge.js`)

The single-flight coordinator. State: `_pending` (round ownership, lifecycle,
detached flag, and resume waiters), `_completed` (short-lived requestId cache),
and `_seq` (monotonic counter for ids). Recoverable lifecycle, draft, and
delivery data are persisted through `lib/round-store.cjs`; browser storage is
only a replay mirror.

| Method                        | Behavior                                                                                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `submitQuestions(questions)`  | Stores a new pending set, returns a Promise that resolves on answers. **Throws if one is already pending.**                                         |
| `peek()`                      | `{ id, questions }` or `null` — side-effect free.                                                                                                   |
| `getCurrent()`                | Just the questions array (or `null`).                                                                                                               |
| `provideAnswers(id, answers)` | **Contract R:** resolves only if `id` matches the current pending round's id. Returns `true` on resolve, `false` on mismatch/no pending (no throw). |
| `cancel(reason, expectedId?)` | **Contract R:** rejects the pending promise only if `expectedId` is absent or matches. Returns `true` on cancel, `false` on mismatch/no pending.    |
| `detach(reason, expectedId)`  | Keeps a requestId-bearing round alive after host disconnect until the bounded TTL; ownership-checked.                                               |
| `waitForAnswers(selector)`    | Requires an exact `roundId` or uniquely matching `requestId`, then returns a cancellable waiter without cancelling the browser round.               |

Round identity (`_seq` monotonically incremented) is the mechanism that makes
cross-round answer mix-up structurally impossible: a late `/answer` carrying
the previous round's id is rejected by `provideAnswers` before it can silently
resolve the new round.

Cancellation reasons are normalized at this boundary: `user cancelled` →
`user_cancelled`, `host cancelled` → `host_cancelled`, `browser disconnected` →
`browser_disconnect`, `timeout` → `application_timeout`; unknown internal
reasons become `bridge_error`. The rejected owner error carries both `code` and
`roundId`, while a mismatched operation leaves the active pending record
untouched.

## Shared validation and client

`lib/question-contract.cjs` is the single validation source shared by the HTTP
bridge and MCP preflight. It rejects malformed option strings before any
browser or bridge work begins and returns actionable errors.

`lib/bridge-client.mjs` is shared by the hook and MCP server.

Used by both the hook and the MCP server. Port/base from `ASKUSER_PORT`
(default `4517`), base `http://127.0.0.1:${PORT}`.

- `ensureServer()` — `GET /health` checking both `ok: true` and `app === APP_ID`
  (identity check prevents a foreign process on the same port from being
  accepted). If down, spawns `server/server.js` detached and polls up to
  30×100ms. Single-flight: concurrent callers share one spawn via the
  `inflight` promise. Spawn errors (ENOENT, permission) are surfaced via
  `log('bridge', e)` instead of silently swallowed.
- `waitForPending({ timeoutMs?, intervalMs? })` — polls `GET /current` until
  `body.id != null` or the deadline passes. Used by both the hook and MCP
  server to delay `openBrowser()` until the round is registered (race guard).
- `openBrowser()` — OS opener: `open` (macOS), `cmd /c start` (Windows),
  `xdg-open` (Linux), pointed at the base URL. Errors reported via
  `log('browser', e)`.
- `askBridge(questions, { timeoutMs })` — `POST /ask`; returns the answers
  object or throws. Uses `AbortController` for the timeout. Abort → typed
  `TimeoutError`; HTTP failures preserve status and `{error}` as typed
  `BridgeError` instances instead of being hidden by pending-round polling.
  JSON parse failure on the response → descriptive Error (not silent).
- `TimeoutError` — exported class; `name === 'TimeoutError'`; thrown only on
  `AbortController` timeout (not on HTTP errors or JSON failures).
- `BridgeError` — exported class with `status` and parsed `body`; used to show
  actionable validation failures such as the required `{label}` option shape.
- `resumeBridge(selector, { timeoutMs?, signal? })` — `POST /resume`; requires
  an exact `roundId` or `requestId` to recover a detached round after a host-side connection deadline.
- `cancelBridge(requestId, reason?)` — resolves the current round id and sends
  explicit `/cancel` before an MCP cancellation closes the owning stream.

### MCP host liveness

`mcp-server/askuserquestionspro-mcp.mjs` keeps the `tools/call` response open
while the browser round is active. If the caller includes a valid
`params._meta.progressToken`, it emits rate-limited
`notifications/progress` messages with that same token and a monotonically
increasing progress value. The heartbeat is stopped in `finally` on answer,
cancellation, bridge failure, or application timeout. It never invents a token
and never carries question or answer data.

This is an optional MCP liveness signal, not a replacement for the one-hour
application timeout and not proof that a host has no separate hard deadline.
On host cancellation the lifecycle records an explicit `host_cancelled` reason
without emitting a late tool result; the host-native input tool remains the
recovery path. On a bridge timeout or other bridge error it preserves the
distinct category so the fallback is actionable.

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
  directory lease); stamps `_v: 1`. **Contract W:** returns
  `{ ok: true, value: next }` on success or `{ ok: false, value: next, error: e }`
  on disk failure (never swallows the error silently). Callers check `ok`
  before trusting the write.
- `getPath()` — the resolved file path.

### Atomic write helper (`lib/atomic-write.cjs`)

`writeFileAtomic(file, data)` — writes data to `file.tmp.<pid>`, then
`rename`s it into place (POSIX-atomic). A `mkdir` directory lease
(`file.lock/owner`) serialises concurrent writers: creating the directory is
the atomic acquisition, and a second writer fails fast rather than racing to
`rename`. The owner records its PID, a random lease token, and (where Linux
procfs provides it) the process start identity. Crash recovery removes only a
confirmed-dead owner's private `owner` entry, then atomically retires the now
empty lease directory with `rmdir`; it never unlinks the public lease pathname.
A live PID with a missing or unreadable identity is treated as uncertain and
remains held (fail closed); operators must remove such a lease only after
confirming the writer is gone. A mismatched identity proves PID reuse, so the
crashed lease can be recovered safely. Orphan `.tmp` files are cleaned up on
failure. Consumed by `lib/settings.js` and `bin/install.js`.

## Hook (`hooks/askuserquestionspro-bridge.mjs` + `hooks/hook-output.js`)

The Claude Code-only `PreToolUse` interceptor for native `AskUserQuestion`
(≤4 questions). Codex hooks cannot return answers as a native
`request_user_input` result, so its adapter uses MCP + skill guidance instead.
The hook is an executable `.mjs`. Flow:

1. Read JSON from stdin; expect `input.tool_input.questions`.
2. If `ASKUI_FORCE_MCP` is set → **deny** the native call with a reason telling
   Claude to use `mcp__askuserquestionspro__ask` instead. (Opt-in: always use
   the unlimited MCP path.)
3. `ensureServer()` → start `askBridge(questions, {timeoutMs: 60 min})` →
   `waitForPending()` until the round appears → `openBrowser()` → await the
   open request. The browser never opens before the server exposes the round.
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
Exposes host-neutral `ask` and `resume` tools (full names
`mcp__askuserquestionspro__ask` and `mcp__askuserquestionspro__resume`) to
Claude Code, Codex CLI, and ChatGPT Desktop. The `ask` questions schema has no
`maxItems` limit.

Methods: `initialize`, `tools/list`, `tools/call`, `ping`. Notifications
(`id === undefined`) are logged and ignored. Reads line-delimited JSON from
STDIN, buffering partial lines. On STDIN `end`, any trailing buffered line is
flushed and attempted to parse; JSON parse errors there are logged to STDERR
(not silently swallowed).

Initialization supports MCP `2025-11-25`, `2025-06-18`, and `2024-11-05`. An
unknown requested version is negotiated to the current supported `2025-11-25`
value instead of being echoed as if it were supported.

`handleAsk(args)` first runs the shared question validator, then imports
`ensureServer/openBrowser/askBridge/waitForPending` from
`lib/bridge-client.mjs`. It starts the round, waits until it is pending, then
opens the browser and awaits the one-hour application deadline. Early HTTP
validation failures race the pending poll, so they are returned immediately.
Success returns
the same `{answers}` object as both JSON text `content` and
`structuredContent`; all-skipped returns `{ answers: {} }` through both
channels. Failure returns `isError` guidance to use the host-native user-input
tool (`request_user_input` in Codex, `AskUserQuestion` in Claude Code).
If pending-round registration fails, the caller aborts its `/ask` request so the
single-flight bridge is not left occupied. `handleResume(args)` waits on a
detached round and returns the same structured answer shape. An explicit MCP
`notifications/cancelled` sends `/cancel` first; a host that disappears without
that notification leaves a bounded detached round for `resume`.

The tool publishes an `outputSchema` requiring an `answers` object and these
annotations: `readOnlyHint: true`, `destructiveHint: false`,
`openWorldHint: false`, and `idempotentHint: false`. The `initialize` response
includes server instructions recommending the rich UI and host-native
fallback. These metadata complement the installed `askpro` skill.

Tool input schema: see [api.md](api.md).

## CLI (`bin/cli.js` + `bin/install.js`)

`bin/cli.js` — executable `askuserquestionspro`. Subcommands:

| Command     | What it does                                                                                                                                                                                                                 |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `init`      | Alias for `install`; accepts the same target selector.                                                                                                                                                                       |
| `install`   | For each selected host, deploy the native skill path and register MCP; for Claude, also install the `PreToolUse` hook.                                                                                                       |
| `uninstall` | Remove each selected host's MCP registration and skill; for Claude, also remove the hook.                                                                                                                                    |
| `serve`     | Run `server/server.js` in foreground (debug).                                                                                                                                                                                |
| `mcp`       | Run the MCP stdio server in foreground (debug).                                                                                                                                                                              |
| `settings`  | `settings` / `settings list` prints all entries + the config file path; `settings get <key>` prints one value; `settings set <key> <val>` coerces + writes via `lib/settings.js` (unknown key / invalid value → error exit). |
| `doctor`    | Per selected host: hook status (Claude), skill, executable, and MCP registration; then package files, optional bridge health, and settings. Accepts the same `--target` values.                                              |
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

### Host platform adapter (`lib/host-platforms.cjs`)

- Valid targets: `auto`, `all`, `claude`, `codex`.
- On install, `auto` selects discovered executables and prepares Claude files
  when no host is detected for backward compatibility. Doctor/uninstall also
  detect residual skill, hook, or Codex config artifacts when an executable was
  removed.
- Executable overrides: `ASKUI_CLAUDE_BIN`, `ASKUI_CODEX_BIN`.
- Codex discovery checks `codex` on `PATH`, then macOS bundled executables in
  `/Applications/ChatGPT.app/Contents/Resources/codex` and
  `/Applications/Codex.app/Contents/Resources/codex`.
- Skill destinations: `~/.claude/skills/askpro` and
  `~/.agents/skills/askpro`.
- Claude MCP commands use `claude mcp ... --scope user`; Codex commands use
  `codex mcp ...`. The latter configuration is shared by Codex CLI and the
  Codex surface in ChatGPT Desktop.
- MCP registration persists the absolute `process.execPath` for Node so a
  GUI-launched desktop host does not depend on the user's interactive-shell
  `PATH`. Codex doctor verifies that executable and the exact MCP script path.

## Install script (`install.sh`)

`curl | bash`-friendly. Accepts `--target auto|all|claude|codex`,
downloads/extracts the repo, copies the runtime plus `skill/` to
`~/.local/share/askuserquestionspro/`, then delegates host registration and
doctor verification to the bundled CLI. Claude gets its hook, MCP entry, and
`~/.claude/skills/askpro`; Codex gets its MCP entry and
`~/.agents/skills/askpro`. On macOS the shell path also searches matching
bundled executables under `~/Applications`.

Shell hardening applied: uses `WORKDIR` (not `TMPDIR`) to avoid shadowing the
env var; single-quotes the `trap` argument; validates the `jq` output with
`jq -e` before `mv` (corrupt output never clobbers the live settings file);
intent-based idempotent hook deduplication (removes any existing
`askuserquestionspro` PreToolUse entry before re-adding, matching on the
command string rather than exact object equality).

## Clean reinstall script (`reinstall.sh`)

`reinstall.sh` passes `--target auto|all|claude|codex` unchanged through
uninstall and install. `uninstall.sh` removes bridge processes plus the selected
hosts' registrations and skills. For a host-specific uninstall it preserves the
shared runtime, UI settings, and npm package when the other host still has an
adapter pointing at them; when every installed host is removed it deletes the
shared files too. It keeps cleaning after individual failures and verifies
residues. Reinstall continues to the idempotent install even when cleanup
reports a recoverable residue.

## Settings commands

`askuserquestionspro settings export` prints the allowlisted v2 envelope. `settings import-preview <file|->` validates without applying and exits 0 for an applicable preview, 2 for invalid/future input, or 64 for usage/I/O errors. `settings reset <namespace>` performs a namespace-only CAS reset. Export and doctor output never includes raw unknown values, secrets, commands, or loopback configuration.

### Settings HTTP preview/apply contract

`POST /settings/preview` requires `{payload, baselineRevision}` and never writes. It returns a one-time
`previewId`, status, validation errors, migration/ignored-data details, and `canApply`. Apply requires the
preview id, the exact candidate payload, and the same baseline revision. The server revalidates the payload,
preview, and current revision before one CAS-backed atomic write; stale, expired, reused, restarted, future,
or mismatched requests preserve the current bytes. A failed write does not consume the preview. Reset is
namespace-only and CAS-protected. Doctor uses a deterministic allowlisted projection with no absolute path.
