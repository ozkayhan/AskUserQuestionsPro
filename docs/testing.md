# Testing

## Runner

Native `node:test`. No frameworks, no config.

```bash
npm test        # node --test (whole suite)
node --test test/bridge.test.js   # one file
```

CI runs `npm install && npm test` on Node 18, 20, 22
(`.github/workflows/ci.yml`).

## Layout

One test file per module in `test/`:

| Test file                    | Covers                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `test/answer-map.test.js`    | `web/answer-map.js` — `mapAnswers`, `decideActivate`, `savePopupState` (pure selection logic).               |
| `test/bridge.test.js`        | `server/bridge.js` — single-flight submit/resolve/cancel/peek.                                               |
| `test/bridge-client.test.js` | `lib/bridge-client.mjs` — server bootstrap / `askBridge`.                                                    |
| `test/server.test.js`        | `server/server.js` — HTTP endpoints, SSE, validation, `index.html` settings injection, `POST /settings`.     |
| `test/settings.test.js`      | `lib/settings.js` + `web/settings-schema.js` — disk read/write/atomicity, self-heal, schema validate/coerce. |
| `test/hook-output.test.js`   | `hooks/hook-output.js` — `buildHookOutput` payload shape.                                                    |
| `test/install.test.js`       | `bin/install.js` — `addHook`/`removeHook` status transitions.                                                |
| `test/mcp-server.test.js`    | `mcp-server/askuserquestionspro-mcp.mjs` — JSON-RPC handling, `ask` tool.                                    |
| `test/themes.test.js`        | `web/themes.js` — theme registry, token application.                                                         |

## Isolation helper (`test/helpers/isolation.js`)

**Contract T:** `withClean(t, fn)` snapshots the `AnswerMap` enabled-state
map and any relevant `process.env` keys, runs `fn`, and restores them in
`t.after` — even if `fn` throws. Prevents global-state leaks (`ENABLED`,
`XDG_CONFIG_HOME`, bridge singleton) from causing false-positive / ordering-
dependent test failures. Used by every stateful test that touches
`AnswerMap.setEnabled` or environment variables.

## Wire round-trip tests (`test/server.test.js`)

In addition to unit-level HTTP tests, `server.test.js` includes:

- **`validQuestions` fuzz / boundary tests** — empty string, >1000-char
  question, >500-char option label, invalid type enum, scale missing
  min/max, scale step ≤ 0, ranking < 2 options, binary ≠ 2 options, tree
  depth > 6, tree `children` non-array, tree nested label non-string / empty.
  Every case asserts HTTP 400 and a descriptive error string.
- **Contract R wire tests** — stale id → 409; `answers` not Array → 400;
  correct id resolves; concurrent `/ask` → 409 on the second.
- **Poll helpers** — `waitForPending()` and `waitForClear()` poll `/current`
  in a tight loop instead of sleeping, making the suite deterministic under CI
  load.
- **`requestTimeout = 0`** — asserted directly: `server.requestTimeout === 0`.

## Notes

- The pure modules (`answer-map`, `bridge`, `install`, `hook-output`, `themes`)
  are the most thoroughly unit-tested because they have no I/O.
- `web/answer-map.js` and `web/themes.js` are written so they can be imported
  by Node tests as well as run in the browser.
- `server.test.js` isolates disk I/O by setting `XDG_CONFIG_HOME` to a tmp
  dir before requiring the server module (the settings dir is resolved at
  load time).
