# API & Contracts

Three surfaces: the host-neutral bridge HTTP API, the shared MCP `ask` tool,
and Claude Code's hook stdin/stdout shapes. Codex uses MCP + skill guidance:
its hooks cannot return answers as the native `request_user_input` result.

## HTTP endpoints (`server/server.js`, port `ASKUSER_PORT` / 4517)

All on `127.0.0.1`. No auth (localhost-only, single user).

| Method & path    | Body                      | Response                                                       | Purpose                                                                                                                                                                                                                   |
| ---------------- | ------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /health`    | —                         | `{ ok: true, app: "<APP_ID>" }`                                | Liveness probe (used by `ensureServer`). Includes `app` field so the client can distinguish this server from any other process that happens to own the port.                                                              |
| `GET /current`   | —                         | `{ id, questions }` or `{ id: null, questions: null }`         | Peek at the pending set.                                                                                                                                                                                                  |
| `GET /events`    | —                         | `text/event-stream`                                            | SSE: pushes `{ id, questions }` on change + ~25s keepalive.                                                                                                                                                               |
| `POST /ask`      | `{ questions: [...] }`    | `{ answers: {...} }` (blocks until answered) or error          | Submit a question set; request stays open until answered or the caller's deadline. Returns HTTP 400 on validation failure, 409 if a set is already pending.                                                               |
| `POST /resume`   | `{ requestId? }`          | `{ answers: {...} }` (blocks until answered) or 409            | Resume the latest detached host round, or the detached round for a specific request id.                                                                                                                                   |
| `POST /answer`   | `{ id, answers: {...} }`  | `{ ok: true }` (200) or error                                  | The browser submits the user's answers. `id` must match the current pending round (Contract R); mismatched id → 409 with `reason: "stale_round"`. `answers` must be a plain object (not null/array/primitive) → else 400. |
| `POST /cancel`   | `{ id, reason? }`         | `{ ok: true, reason }` (200) or error                          | Cancel exactly the matching round. Allowlisted reasons are `user cancelled`, `host cancelled`, `browser disconnected`, and `timeout`; stale ids → 409.                                                                    |
| `POST /settings` | `{ <key>: <value>, ... }` | `{ ok: true, settings: {...} }` (200) or `{ error }` (400/500) | Persist a UI-settings patch. Returns 400 on bad JSON/non-object, 500 if the disk write fails (Contract W). `_v` is stripped from the response.                                                                            |
| `GET *`          | —                         | static file                                                    | Serves `web/` (traversal-guarded). `GET /` (index.html) is rewritten to inject `window.__ASKUSER_SETTINGS__`.                                                                                                             |

Request bodies are capped at 8 MB. If a requestId-bearing `/ask` client
disconnects, the server detaches rather than cancels the pending set. The
browser may continue collecting answers for up to one hour; a new host process
can call `/resume` to receive them. Detached rounds are bounded by
`ASKUSER_DETACHED_ROUND_TTL_MS` (default one hour), so they cannot become
unbounded orphans. Requests without a requestId preserve the original
cancel-on-disconnect behavior. The explicit `/cancel` route uses the same id
ownership check and is safe to repeat after the first terminal transition.

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
  "id": 42, // required — must match the current pending round's id; mismatch → 409
  "answers": {
    /* opaque plain object; server stores and returns as-is */
  },
}
```

The server validates `!answers || typeof answers !== 'object' || Array.isArray(answers)`
→ 400 if not a plain object. The `id` field enables cross-round race protection:
a stale response from a previous round cannot silently resolve a new pending set.

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
  or a stale/missing round was targeted (`reason: "stale_round"`)

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

The `resume` tool accepts an optional original `requestId`; with no argument it
selects the latest detached round for this single-user bridge. It waits for the
browser answer and returns the same `{ answers }` result shape as `ask`.

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
