# API & Contracts

Three surfaces: the bridge server's HTTP endpoints, the MCP `ask` tool, and
the hook's stdin/stdout shapes.

## HTTP endpoints (`server/server.js`, port `ASKUSER_PORT` / 4517)

All on `127.0.0.1`. No auth (localhost-only, single user).

| Method & path    | Body                      | Response                                               | Purpose                                                                                                       |
| ---------------- | ------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `GET /health`    | —                         | `{ ok: true }`                                         | Liveness probe (used by `ensureServer`).                                                                      |
| `GET /current`   | —                         | `{ id, questions }` or `{ id: null, questions: null }` | Peek at the pending set.                                                                                      |
| `GET /events`    | —                         | `text/event-stream`                                    | SSE: pushes `{ id, questions }` on change + ~25s keepalive.                                                   |
| `POST /ask`      | `{ questions: [...] }`    | `{ answers: {...} }` (blocks until answered) or error  | Submit a question set; request stays open until answered/timeout.                                             |
| `POST /answer`   | `{ answers: {...} }`      | resolves the pending set                               | The browser submits the user's answers.                                                                       |
| `POST /settings` | `{ <key>: <value>, ... }` | `{ ok: true, settings: {...} }` or `{ error }` (400)   | Persist a UI-settings patch (schema-validated by `lib/settings.js`).                                          |
| `GET *`          | —                         | static file                                            | Serves `web/` (traversal-guarded). `GET /` (index.html) is rewritten to inject `window.__ASKUSER_SETTINGS__`. |

Request bodies are capped at 8 MB. If the `/ask` client disconnects, the
server cancels the pending set.

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
- `scale`: `min`, `max`, `step` required; no `options`.
- `ranking`: `options` required (≥ 2 items); no "Other".
- `tree`: `options` required (non-empty); `children` makes a non-leaf node; depth ≤ 6; no "Other".

The UI auto-appends an "Other" custom option **only** for `single` and `multi`
questions (`web/ui-kit.js`).

### Answer shape (`POST /answer` and `/ask` result)

```jsonc
{
  "answers": {
    "<question text>": "Label", // single, binary → string
    "<question text>": ["A", "B"], // multi → array of strings
    "<question text>": 7, // scale → number
    "<question text>": ["First", "Second"], // ranking → ordered string[]
    "<question text>": ["Root", "Child", "Leaf"], // tree → path string[]
  },
}
```

Unanswered questions are omitted. A custom ("Other") selection is mapped to
the user's typed text. Mapping is produced by `AnswerMap.mapAnswers`
(`web/answer-map.js`).

## MCP tool: `mcp__askuserquestionspro__ask`

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

Result: tool content is JSON text of `{ answers: {...} }` (same answer shape as
above, type-aware). On server-unavailable / timeout / cancel, returns an
`isError` message suggesting the built-in `AskUserQuestion` tool.
All-skipped → `{ answers: {} }`.

Supported RPC methods: `initialize`, `tools/list`, `tools/call`, `ping`.

### Server-side validation (`server/server.js → validQuestions`)

Returns `{ok:true}` or `{ok:false, error:"<human-readable>"}`. Rules per type:

- All: `type` must be a valid enum value (or absent).
- `single`/`multi`: `options` non-empty.
- `binary`: `options` absent or length === 2.
- `scale`: `min < max`, `step > 0`, all numeric.
- `ranking`: `options` length ≥ 2.
- `tree`: `options` non-empty, `children` (if present) must be arrays, depth ≤ 6.

`POST /ask` returns HTTP 400 with `{ error }` on validation failure so the
caller can correct the question shape.

## Hook I/O (`hooks/askuserquestionspro-bridge.mjs`)

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
