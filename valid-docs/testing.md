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

| Test file | Covers |
|-----------|--------|
| `test/answer-map.test.js` | `web/answer-map.js` — `mapAnswers`, `decideActivate`, `savePopupState` (pure selection logic). |
| `test/bridge.test.js` | `server/bridge.js` — single-flight submit/resolve/cancel/peek. |
| `test/bridge-client.test.js` | `lib/bridge-client.mjs` — server bootstrap / `askBridge`. |
| `test/server.test.js` | `server/server.js` — HTTP endpoints, SSE, validation, `index.html` settings injection, `POST /settings`. |
| `test/settings.test.js` | `lib/settings.js` + `web/settings-schema.js` — disk read/write/atomicity, self-heal, schema validate/coerce. |
| `test/hook-output.test.js` | `hooks/hook-output.js` — `buildHookOutput` payload shape. |
| `test/install.test.js` | `bin/install.js` — `addHook`/`removeHook` status transitions. |
| `test/mcp-server.test.js` | `mcp-server/askuserquestionspro-mcp.mjs` — JSON-RPC handling, `ask` tool. |
| `test/themes.test.js` | `web/themes.js` — theme registry, token application. |

## Notes

- The pure modules (`answer-map`, `bridge`, `install`, `hook-output`, `themes`)
  are the most thoroughly unit-tested because they have no I/O.
- `web/answer-map.js` and `web/themes.js` are written so they can be imported
  by Node tests as well as run in the browser.
