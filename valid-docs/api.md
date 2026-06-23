# API & Contracts

Three surfaces: the bridge server's HTTP endpoints, the MCP `ask` tool, and
the hook's stdin/stdout shapes.

## HTTP endpoints (`server/server.js`, port `ASKUSER_PORT` / 4517)

All on `127.0.0.1`. No auth (localhost-only, single user).

| Method & path | Body | Response | Purpose |
|---------------|------|----------|---------|
| `GET /health` | — | `{ ok: true }` | Liveness probe (used by `ensureServer`). |
| `GET /current` | — | `{ id, questions }` or `{ id: null, questions: null }` | Peek at the pending set. |
| `GET /events` | — | `text/event-stream` | SSE: pushes `{ id, questions }` on change + ~25s keepalive. |
| `POST /ask` | `{ questions: [...] }` | `{ answers: {...} }` (blocks until answered) or error | Submit a question set; request stays open until answered/timeout. |
| `POST /answer` | `{ answers: {...} }` | resolves the pending set | The browser submits the user's answers. |
| `POST /settings` | `{ <key>: <value>, ... }` | `{ ok: true, settings: {...} }` or `{ error }` (400) | Persist a UI-settings patch (schema-validated by `lib/settings.js`). |
| `GET *` | — | static file | Serves `web/` (traversal-guarded). `GET /` (index.html) is rewritten to inject `window.__ASKUSER_SETTINGS__`. |

Request bodies are capped at 8 MB. If the `/ask` client disconnects, the
server cancels the pending set.

### Question shape

```jsonc
{
  "question": "string",          // required — the prompt text (also the answer key)
  "header":   "string",          // group/category label
  "options": [                    // selectable options
    { "label": "string", "description": "string (optional)" }
  ],
  "multiSelect": false            // optional; true = allow multiple selections
}
```

The UI auto-appends an "Other" custom option to every question
(`web/ui-kit.js`).

### Answer shape (`POST /answer` and `/ask` result)

```jsonc
{
  "answers": {
    "<question text>": "Label",        // single-select → string
    "<question text>": ["A", "B"]      // multi-select → array of strings
  }
}
```

Unanswered questions are omitted. A custom ("Other") selection is mapped to
the user's typed text. Mapping is produced by `AnswerMap.mapAnswers`
(`web/answer-map.js`).

## MCP tool: `mcp__askuserquestionspro__ask`

Defined in `mcp-server/askuserquestionspro-mcp.mjs` as tool `ask`. Transport:
JSON-RPC 2.0 over stdio.

Input schema:

```jsonc
{
  "type": "object",
  "required": ["questions"],
  "properties": {
    "questions": {
      "type": "array",
      "minItems": 1,            // no maxItems → unlimited questions
      "items": {
        "type": "object",
        "required": ["question", "header", "options"],
        "properties": {
          "question":   { "type": "string" },
          "header":     { "type": "string" },
          "options":    { "type": "array", "items": { /* label, description? */ } },
          "multiSelect":{ "type": "boolean" }
        }
      }
    }
  }
}
```

Result: tool content is JSON text of `{ answers: {...} }` (same answer shape as
above). On server-unavailable / timeout / cancel, returns an `isError` message
suggesting the built-in `AskUserQuestion` tool. All-skipped → `{ answers: {} }`.

Supported RPC methods: `initialize`, `tools/list`, `tools/call`, `ping`.

## Hook I/O (`hooks/askuserquestionspro-bridge.mjs`)

**stdin** (from Claude Code `PreToolUse`):

```jsonc
{ "tool_input": { "questions": [ /* question shape */ ] } }
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
