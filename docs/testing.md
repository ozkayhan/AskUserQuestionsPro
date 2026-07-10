# Testing

## Runner

Native `node:test`. No frameworks, no config.

```bash
npm test        # node --test (whole suite)
node --test test/bridge.test.js   # one file
```

CI runs `npm ci && npm test` on Node 18, 20, 22
(`.github/workflows/ci.yml`).

## Layout

There are 24 top-level `*.test.js` files:

`evals/askpro-skill-cases.json` contains positive and negative payload cases,
including the string-options failure that prompted the contract hardening.
`test/skill-evals.test.js` runs those cases against the shared validator and
asserts that the skill explicitly teaches the invariant and its recovery path.

| Test file                        | Covers                                                                                    |
| -------------------------------- | ----------------------------------------------------------------------------------------- |
| `answer-map.test.js`             | Pure answer mapping and activation decisions.                                             |
| `bridge-client.test.js`          | Server bootstrap, pending-round wait, browser/client behavior, and timeout typing.        |
| `bridge.test.js`                 | Single-flight submit/resolve/cancel/round identity.                                       |
| `changesets-config.test.js`      | Changesets configuration.                                                                 |
| `cli.test.js`                    | CLI help/settings/doctor plus Codex-only install/doctor/uninstall isolation.              |
| `eslint-prettier-config.test.js` | Lint and formatting configuration invariants.                                             |
| `hook-output.test.js`            | Claude `PreToolUse` output filtering and shape.                                           |
| `host-platforms.test.js`         | Target parsing/selection, macOS bundled Codex discovery, host MCP argv, and skill paths.  |
| `install.test.js`                | Claude hook settings mutations and conflict handling.                                     |
| `live.test.js`                   | Browser SSE and answer-posting helpers.                                                   |
| `mcp-server.test.js`             | JSON-RPC lifecycle/version negotiation, cancellation, schema, instructions, and metadata. |
| `server.test.js`                 | HTTP/SSE/static/settings behavior, validation fuzzing, and round-safe wire flow.          |
| `shell-lifecycle.test.js`        | Target-specific shell cleanup preserves the runtime used by the other host.               |
| `settings-panel.test.js`         | Settings panel behavior.                                                                  |
| `settings-schema.test.js`        | Settings schema validation/coercion.                                                      |
| `settings.test.js`               | Disk read/write, atomicity, self-heal, and concurrency.                                   |
| `themes.test.js`                 | Theme registry and token application.                                                     |
| `ui-kit.test.js`                 | Shared UI primitives and type-specific Other-option behavior.                             |
| `views-a11y.test.js`             | Accessibility structure and annotations.                                                  |
| `views.test.js`                  | Question and summary view rendering behavior.                                             |
| `workflows-ci.test.js`           | CI workflow guards.                                                                       |
| `workflows-release.test.js`      | Release workflow guards.                                                                  |

The multi-host additions are deliberately split: `host-platforms.test.js`
owns pure selection/discovery/command contracts, `cli.test.js` proves a Codex
target does not touch Claude state, `shell-lifecycle.test.js` protects shared
runtime ownership, and `mcp-server.test.js` proves the metadata that helps both
hosts discover and consume the tool.

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
