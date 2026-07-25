# API & Contracts

Three surfaces: the host-neutral bridge HTTP API, the shared MCP `ask` tool,
and Claude Code's hook stdin/stdout shapes. Codex uses MCP + skill guidance:
its hooks cannot return answers as the native `request_user_input` result.

## HTTP endpoints (`server/server.js`, port `ASKUSER_PORT` / 4517)

Lifecycle snapshots are payload-free: `id`, opaque `capability`, `state`, `deadlineOwner`, `terminalReason`, and timestamps. Browser `/answer` and `/cancel` mutations require both the numeric id and server-issued capability; missing, stale, or wrong capabilities return `ownership_conflict`. States are drafting, detached, reconnecting, delivery-pending, delivered, delivery-uncertain, cancelled, recovery-error, and expired. Lifecycle diagnostics allowlist boundary, deadline owner, reason, elapsed time, adapter, and opaque IDs only; question and answer content is never logged.

All on `127.0.0.1`. No auth (localhost-only, single user).

| Method & path                  | Body                                           | Response                                                              | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------ | ---------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /health`                  | —                                              | `{ ok: true, app: "<APP_ID>" }`                                       | Liveness probe (used by `ensureServer`). Includes `app` field so the client can distinguish this server from any other process that happens to own the port.                                                                                                                                                                                                                                                                                                                                                       |
| `GET /current`                 | —                                              | `{ id, questions }` or `{ id: null, questions: null }`                | Peek at the pending set.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `GET /events`                  | —                                              | `text/event-stream`                                                   | SSE: pushes `{ id, questions }` on change + ~25s keepalive.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `GET /rounds`                  | —                                              | `{ rounds: [...] }`                                                   | List non-expired drafting, detached, and delivery-uncertain records plus reconnecting records retained beyond their initial detached TTL, as redacted exact-round metadata.                                                                                                                                                                                                                                                                                                                                        |
| `POST /ask`                    | `{ questions: [...] }`                         | `{ answers: {...} }` (blocks until answered) or error                 | Submit a question set; request stays open until answered or the caller's deadline. Returns HTTP 400 on validation failure, 409 if a set is already pending.                                                                                                                                                                                                                                                                                                                                                        |
| `POST /resume`                 | `{ roundId?, requestId? }` (one required)      | `{ answers: {...} }` (blocks until answered) or typed error           | Resume only an exact durable round or a uniquely matching request id; no recency selection.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `POST /draft`                  | `{ id, capability, revision, answers: {...} }` | `{ ok, revision, replayed }` or typed error                           | Persist each material browser edit immediately when the capability and expected revision match. Writes are serialized so revisions remain ordered; identical retries are idempotent and a different stale edit returns `stale_revision`. The browser retains an unacknowledged local replay mirror keyed by round, capability, and expected revision; it uses `fetch(..., { keepalive: true })` for small teardown-time requests and replays after reload/reconnect until this response acknowledges the revision. |
| `POST /answer`                 | `{ id, capability, answers: {...} }`           | `{ ok: true }` (200) or error                                         | The browser submits the user's final answers. Both `id` and the opaque server-issued `capability` must match the current pending round; missing, stale, or wrong ownership credentials → 409 with `reason: "ownership_conflict"`. `answers` must be a plain object (not null/array/primitive) → else 400.                                                                                                                                                                                                          |
| `POST /cancel`                 | `{ id, capability, reason? }`                  | `{ ok: true, reason }` (200) or error                                 | Cancel exactly the matching round. Both `id` and opaque `capability` are required. Allowlisted reasons are `user cancelled`, `host cancelled`, `browser disconnected`, and `timeout`; missing, stale, or wrong ownership credentials → 409 with `reason: "ownership_conflict"`.                                                                                                                                                                                                                                    |
| `POST /rounds/:roundId/delete` | —                                              | `{ ok: true }` (200) or typed error                                   | Confirmation-gated exact deletion of one recoverable durable record. The path is the only selector; capabilities, answers, question data, paths, and diagnostics are neither required nor returned.                                                                                                                                                                                                                                                                                                                |
| `POST /settings`               | `{ <key>: <value>, ... }`                      | `{ ok: true, settings: {...} }` (200) or `{ error }` (400/500)        | Persist a UI-settings patch. Returns 400 on bad JSON/non-object, 500 if the disk write fails (Contract W). `_v` is stripped from the response.                                                                                                                                                                                                                                                                                                                                                                     |
| `GET /settings/doctor`         | —                                              | Redacted `{ status, revision, migration, effective }` projection      | Read-only settings health/effective values for the browser and diagnostics; never exposes the config path or unknown raw fields.                                                                                                                                                                                                                                                                                                                                                                                   |
| `GET /settings/export`         | —                                              | Downloadable v2 JSON envelope                                         | Export the allowlisted settings envelope with `no-store` caching.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `POST /settings/preview`       | `{ payload, baselineRevision }`                | One-time `{ previewId, valid, canApply, errors, migration, ignored }` | Validate an import without writing; revision-checks the baseline.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `POST /settings/apply`         | `{ previewId, payload, baselineRevision }`     | `{ ok: true, settings: <v2 envelope> }` or error                      | Apply the exact preview through a CAS-protected atomic write.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `POST /settings/reset`         | `{ namespace, baselineRevision }`              | `{ ok: true, settings: <v2 envelope> }` or error                      | Reset one allowlisted namespace without touching the others.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `GET *`                        | —                                              | static file                                                           | Serves `web/` (traversal-guarded). `GET /` (index.html) is rewritten to inject `window.__ASKUSER_SETTINGS__`.                                                                                                                                                                                                                                                                                                                                                                                                      |

Request bodies are capped at 8 MB. If a requestId-bearing `/ask` client
disconnects, the server detaches rather than cancels the pending set. A new host
process can call `/resume` during the bounded detached TTL. Once resumed, the
round enters `reconnecting`; its waiter and durable snapshot remain open until
the browser answers or an explicit cancellation occurs, including across
multi-day gaps and bridge restarts. Detached rounds that are never resumed are
bounded by `ASKUSER_DETACHED_ROUND_TTL_MS` (default one hour), so they cannot
become unbounded orphans. Requests without a requestId preserve the original
cancel-on-disconnect behavior. The explicit `/cancel` route uses the same id
ownership check and is safe to repeat after the first terminal transition.

### Durable recovery API

The Node bridge owns a versioned local snapshot for each recoverable round.
Browser storage is a mirror only. `GET /rounds` returns non-expired records in
`drafting`, `detached`, or `delivery-uncertain` state plus `reconnecting`
records whose initial detached TTL has elapsed. Delivered, cancelled, expired,
recovery-error, and other terminal
records never reach the chooser. Each item contains redacted exact-round
metadata (`roundId`, optional request id, lifecycle state, revision, timestamps,
expiry, and question count); it never returns question text, answers,
capabilities, paths, or recovery diagnostics. `GET /rounds/:roundId` selects
one exact record and returns the same redacted metadata.

`POST /resume` now requires `roundId`, `requestId`, or both. A supplied pair
must match; absent selectors are rejected rather than selecting by recency.
`POST /rounds/:roundId/result` and `POST /rounds/:roundId/ack` require the
round capability in their JSON body. Result retries return the original answer
projection; acknowledgement retries return the original `acknowledgedAt` and
revision. Missing records are 404, expired records 410, malformed selectors
400, and ownership/ambiguity/not-ready/recovery conflicts 409.
`POST /rounds/:roundId/delete` requires no body and deletes only the exact
recoverable path selector after a fresh expiry/state check. Success returns
`{ ok: true }` and no durable payload. Missing records are 404, expired
records 410, malformed selectors 400, and delivered or otherwise
non-recoverable records 409. Deleting a hydrated current owner rejects its
pending host waiters, clears its timers and in-memory result ownership, and
broadcasts an empty `/current` and SSE snapshot; unrelated round ownership is
unchanged.

The browser recovery surface consumes `GET /rounds` as a redacted chooser. It
must select one exact `roundId` or `requestId`; it never infers the newest
record. A browser draft is a replay cache only. If its revision differs from
the server revision, the UI retains both versions until the user chooses keep
server, review differences, or discard the local draft.

Final delivery is a two-step browser operation: submit enters
`delivery-pending`, then the immutable result is acknowledged at
`POST /rounds/:roundId/ack`. Delivery acknowledgement remains the only
terminal-delivery boundary: only a successful acknowledgement is `delivered`
and eligible for an automatic close attempt. Network or timeout ambiguity is
`delivery-uncertain`; it never closes the tab and preserves the result until
acknowledgement, expiry, or explicit exact deletion. The browser retires the
submitting tab as soon as answer submission is accepted, so later SSE rounds
cannot remount the completed flow. A normal SSE reconnect is silent. After
acknowledgement the browser closes according to the v2 closure setting
(default `after-delivery`, explicit `never` remains valid); if close is denied,
the tab stays passive and permanently ineligible for later rounds. Actual
recovery offers only continue this exact round, cancel/delete it with
confirmation, or start a new round without silently deleting the retained
record. Browser-opening failures expose only the loopback URL and manual
guidance, never executable host commands.

The browser draft writer treats a normal `/draft` response as pending until its
revision acknowledgement settles. This prevents the SSE revision broadcast
from racing local replay reconciliation and showing a false “Saved round
changed” conflict during ordinary answer confirmation and navigation.

Snapshots are retained initially for the resolved detached-round TTL
(`ASKUSER_DETACHED_ROUND_TTL_MS` when valid, otherwise the default). A snapshot
that has entered `reconnecting` is retained beyond that initial deadline until
answer delivery or explicit cancellation; snapshots that never enter that
state remain eligible for expiry cleanup according to their lifecycle. Invalid
individual snapshot files are quarantined; they do not suppress healthy rounds.
Startup and a bounded background schedule delete eligible expired snapshots;
round and quarantine directories are tightened to `0700` even when they
already exist.

### Question shape

```jsonc
{
  "question": "string", // required — the prompt text (also the answer key)
  "header": "string", // group/category label
  "type": "single|multi|binary|scale|ranking|tree", // optional; defaults per multiSelect
  "options": [
    // for single/multi/binary/ranking/tree
    {
      "label": "string",
      "description": "string (optional)",
      "children": [
        /* recursive, tree only */
      ],
    },
  ],
  "multiSelect": false, // optional; true = allow multiple selections (single/multi)
  "min": 0, // scale only
  "max": 10, // scale only
  "step": 1, // scale only (default 1)
  "leftLabel": "string", // scale only
  "rightLabel": "string", // scale only
}
```

Type-specific field rules:

- `binary`: `options` optional; omit for default `[{label:"Evet"},{label:"Hayır"}]`; exactly 2 options; no "Other".
- `scale`: `min`, `max`, `step` required; any provided `options` are ignored for compatibility.
- `ranking`: `options` required (≥ 2 items); no "Other".
- `tree`: `options` required (non-empty); `children` makes a non-leaf node; depth ≤ 6; no "Other".

The UI auto-appends an "Other" custom option **only** for `single` and `multi`
questions (`web/ui-kit.js`).

### Answer shape (`POST /answer` body and `/ask` response)

**`POST /answer` body** (Contract R):

```jsonc
{
  "id": 42, // required — must match the current pending round's id
  "capability": "opaque server-issued capability", // required — missing/stale/wrong → 409 ownership_conflict
  "answers": {
    /* opaque plain object; server stores and returns as-is */
  },
}
```

The server validates `!answers || typeof answers !== 'object' || Array.isArray(answers)`
→ 400 if not a plain object. The `id` plus opaque `capability` pair enforces
round ownership: a missing, stale, or wrong credential cannot silently resolve
or cancel a new pending set and receives `409` with `reason: "ownership_conflict"`.

**`/ask` success response** (returned to the hook / MCP after answering):

```jsonc
{
  "answers": {
    /* the plain object the browser POSTed to /answer */
  },
}
```

The type-aware answer mapping (question text → `string | string[] | number`)
is done by the **browser** before POST (`AnswerMap.mapAnswers` in
`web/answer-map.js`), which produces `{ [question]: answer }`. The server
is answer-opaque.

**`/ask` error responses:**

- `400` — `validQuestions` rejected the payload (missing fields, wrong type, depth > 6, etc.)
- `409` — a question set is already pending (`reason: "round_in_progress"`),
  or a mutation had missing, stale, or wrong ownership credentials
  (`reason: "ownership_conflict"`)

## MCP tools: `mcp__askuserquestionspro__ask` and `mcp__askuserquestionspro__resume`

Defined in `mcp-server/askuserquestionspro-mcp.mjs` as tool `ask`. Transport:
JSON-RPC 2.0 over stdio.

Input schema (abbreviated):

```jsonc
{
  "type": "object",
  "required": ["questions"],
  "properties": {
    "questions": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["question", "header"],
        "properties": {
          "question": { "type": "string" },
          "header": { "type": "string" },
          "type": { "enum": ["single", "multi", "binary", "scale", "ranking", "tree"] },
          "options": { "type": "array", "items": { "$ref": "#/$defs/option" } },
          "multiSelect": { "type": "boolean" },
          "min": { "type": "number" },
          "max": { "type": "number" },
          "step": { "type": "number" },
          "leftLabel": { "type": "string" },
          "rightLabel": { "type": "string" },
        },
      },
    },
  },
  "$defs": {
    "option": {
      "type": "object",
      "required": ["label"],
      "properties": {
        "label": { "type": "string" },
        "description": { "type": "string" },
        "children": { "type": "array", "items": { "$ref": "#/$defs/option" } },
      },
    },
  },
}
```

`options` is no longer required (binary/scale may omit it). For `tree`
questions provide the full option tree in one call; leaf nodes (no `children`)
are the final selectable answers; maximum depth is 6 levels.

Result: successful calls return `{ answers: {...} }` as both JSON text
`content` and MCP `structuredContent` (same type-aware shape as above).
All-skipped returns `{ answers: {} }` through both channels. The declared
`outputSchema` is:

```json
{
  "type": "object",
  "required": ["answers"],
  "properties": { "answers": { "type": "object" } }
}
```

Tool annotations are `readOnlyHint: true`, `destructiveHint: false`,
`openWorldHint: false`, and `idempotentHint: false`. `initialize` returns
server instructions telling Claude/Codex to prefer the rich structured UI and
use the host-native fallback on failure. Server unavailable, the one-hour
application deadline, cancellation, or a concurrent pending round produces an
`isError` result. The named native fallbacks are `request_user_input` in Codex
and `AskUserQuestion` in Claude Code; no host timeout default is assumed.

Supported RPC methods: `initialize`, `tools/list`, `tools/call`, `ping`.
`initialize` recognizes protocol versions `2025-11-25`, `2025-06-18`, and
`2024-11-05`; other requested versions negotiate to `2025-11-25` rather than
being echoed. `notifications/cancelled` accepts the request id and explicitly
cancels the associated round before aborting the in-flight `tools/call` without
returning its unused result. If a host drops the connection without that
notification, the detached round remains recoverable through `resume`.

The `resume` tool requires an original `requestId` or an exact durable
`roundId`; it never selects the latest detached round. It waits for the browser
answer and returns the same `{ answers }` result shape as `ask`.

### Shared validation (`lib/question-contract.cjs`)

Returns `{ok:true}` or `{ok:false, error:"<human-readable>"}`. Rules per type:

- All: `type` must be a valid enum value (or absent).
- `single`/`multi`: `options` non-empty.
- `binary`: `options` absent or length === 2.
- `scale`: `min < max`, `step > 0`, all numeric; `options` are ignored if provided.
- `ranking`: `options` length ≥ 2.
- `tree`: `options` non-empty, `children` (if present) must be arrays, depth ≤ 6.

The same validator runs in the MCP process before `/ask` and in the HTTP
bridge. `options` entries must be objects with a non-empty string `label`;
string arrays are rejected immediately. `POST /ask` returns HTTP 400 with
`{ error }`, and the MCP client preserves that status/body instead of masking it
with a pending-round timeout.

## Claude hook I/O (`hooks/askuserquestionspro-bridge.mjs`)

This answer-return contract exists only for Claude Code `PreToolUse`. Codex
hooks may observe, block, or rewrite `request_user_input` input, but cannot
return answers as that native tool's result.

**stdin** (from Claude Code `PreToolUse`):

```jsonc
{
  "tool_input": {
    "questions": [
      /* question shape */
    ],
  },
}
```

**stdout** (success) — from `buildHookOutput`:

```jsonc
{
  "suppressOutput": true,
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "permissionDecisionReason": "Answered via custom AskUserQuestion UI",
    "updatedInput": { "questions": [ ... ], "answers": { ... } }
  }
}
```

**stdout** (when `ASKUI_FORCE_MCP` set): a `deny` decision directing Claude to
use `mcp__askuserquestionspro__ask`.

**Failure:** exit `0` with no decision → Claude Code falls back to the native
picker.

## Settings v2 HTTP API

`GET /settings/export` returns deterministic redacted JSON with `Cache-Control: no-store` and an attachment filename. `POST /settings/preview` accepts `{payload, baselineRevision}` and returns a one-time preview. `POST /settings/apply` consumes that preview and performs a revision-checked atomic mutation. `POST /settings/reset` accepts `{namespace, baselineRevision}` and resets one known namespace. Stale, reused, expired, invalid, and future previews are rejected without replacing the settings file.
