# Code Map

Start here to navigate. Real paths; "to change X, go to Y".

## Top-level layout

```
.
├── bin/                  CLI + settings-mutation logic
├── hooks/                PreToolUse hook + its output builder
├── mcp-server/           MCP stdio server (the `ask` tool)
├── server/               local bridge HTTP server + Bridge class
├── lib/                  shared client used by hook & MCP
├── web/                  browser UI (React via in-browser Babel)
├── test/                 node:test suite (one file per module)
├── install.sh            curl|bash installer
├── reinstall.sh          clean-reinstall helper (uninstall + fresh install, idempotent)
├── package.json          npm manifest, bin entries, scripts
├── eslint.config.js      ESLint flat config (Node source; web/ excluded)
├── .prettierrc.json      Prettier config
├── .changeset/           Changesets config + pending changesets
├── .github/workflows/    CI (ci.yml: lint + test matrix; release.yml: Changesets publish)
└── docs/                 ← you are here (English, code-verified)
```

## Backend / Node side

| Path                                     | What it is                                                                                                                                                                   | Go here to…                                                                                   |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------- |
| `bin/cli.js`                             | CLI entry (`askuserquestionspro`). Subcommands: `init`, `install`, `uninstall`, `serve`, `mcp`, `settings`, `doctor`, `help`.                                                | Change CLI commands, install/uninstall flow, `settings` get/set/list, `doctor` health checks. |
| `bin/install.js`                         | Pure functions `addHook()` / `removeHook()` that mutate a `settings.json` object. Constants `MATCHER='AskUserQuestion'`, `TIMEOUT=3600`.                                     | Change how the hook entry is added/removed or conflict detection.                             |
| `install.sh`                             | Bash installer (download → copy to `~/.local/share/askuserquestionspro/` → register hook via `jq` → register MCP).                                                           | Change the `curl                                                                              | bash` install path. |
| `mcp-server/askuserquestionspro-mcp.mjs` | JSON-RPC 2.0 stdio MCP server. Defines `ASK_TOOL`, handles `initialize`/`tools/list`/`tools/call`/`ping`. `handleAsk()` routes to bridge-client (60 min timeout).            | Change the `ask` tool schema or MCP protocol handling.                                        |
| `server/server.js`                       | `node:http` server (port `ASKUSER_PORT` or 4517). Routes `/health` `/current` `/events` `/ask` `/answer` + static files from `../web`. Exports `server`, `bridge`.           | Change HTTP endpoints, SSE, static serving, request limits.                                   |
| `server/bridge.js`                       | `Bridge` class: single-flight `_pending` + `_seq`. Methods `submitQuestions` `peek` `getCurrent` `provideAnswers` `cancel`.                                                  | Change question/answer coordination semantics.                                                |
| `lib/bridge-client.mjs`                  | `ensureServer()` `openBrowser()` `askBridge()`. Shared by hook + MCP.                                                                                                        | Change server bootstrap, browser opening, or `/ask` calling.                                  |
| `lib/settings.js`                        | Disk persistence for UI settings: `read()` / `write(patch)` / `getPath()`. Atomic write + schema-validated self-heal. File at `~/.config/askuserquestionspro/settings.json`. | Change settings storage, the config file location, or self-heal behavior.                     |
| `hooks/askuserquestionspro-bridge.mjs`   | The `PreToolUse` hook script. Reads stdin, honors `ASKUI_FORCE_MCP`, calls bridge-client (60 min timeout), falls back to native on error.                                    | Change hook behavior / the force-MCP opt-in.                                                  |
| `hooks/hook-output.js`                   | `buildHookOutput(toolInput, answers)` → the `PreToolUse` allow-decision payload with `updatedInput`.                                                                         | Change the shape returned to Claude Code.                                                     |

## Frontend / browser side (`web/`)

Loaded by `web/index.html` in order: vendor libs → app files (`type="text/babel"`).

| Path                     | What it is                                                                                                                                                               | Go here to…                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `web/index.html`         | HTML shell; mounts `#root`; loads vendor + app scripts.                                                                                                                  | Change script load order, meta, font preloads.                       |
| `web/app.js`             | `App`/`Flow` components — state machine: answers state, navigation, keyboard shortcuts, submit; mounts the settings fab + modal.                                         | Change navigation/keyboard/submit behavior or settings-modal wiring. |
| `web/live.js`            | `useLiveQuestions()` (SSE from `/events`) and `postAnswers()` (POST `/answer`).                                                                                          | Change client↔server transport.                                      |
| `web/views.js`           | Presentational components: `Sidebar`, `QItem`, `SidebarGrouped`, `SidebarSearch`, `Hints`, `QuestionCard`, `CustomPopup`, `Summary`.                                     | Change UI layout/markup.                                             |
| `web/settings-schema.js` | UMD single-source settings schema (browser global `Settings_Schema` + Node `require`). `entries/byKey/defaults/groups/validate/coerce/applyAll`.                         | Add/edit a setting (theme, uiScale, reduceMotion).                   |
| `web/settings-panel.js`  | Settings UI: bottom-left `SettingsButton` fab + centered `SettingsModal` (schema-driven, live preview, POST `/settings`).                                                | Change the settings UI/modal.                                        |
| `web/ui-kit.js`          | Primitives: `Check`, `Kbd`, `Brand` icons; `fullOptions(q)`; `CUSTOM_LABEL`/`CUSTOM_DESC`.                                                                               | Change shared widgets or the "Other" option injection.               |
| `web/answer-map.js`      | Pure logic: `mapAnswers()`, `decideActivate()`, `savePopupState()`. No DOM.                                                                                              | Change selection logic / submission mapping.                         |
| `web/themes.js`          | Theme registry (`amoled`, `paper`, `phosphor`, `dusk`, `aurora`), `read/apply/current/swapFont`, `KNOWN_TOKENS`. `read()` honors the server-injected disk setting first. | Add/edit themes or token handling.                                   |
| `web/styles.css`         | All styling via CSS variables; layout, animations, components.                                                                                                           | Change visual styling.                                               |
| `web/vendor/`            | Vendored React, ReactDOM, Babel.                                                                                                                                         | Bump frontend libs.                                                  |

## Tests

`test/*.test.js` — one file per module, run with `node --test`. See
[testing.md](testing.md).

## Out of scope (not current runtime behavior)

- `design-reference/` — original prototype (`app.jsx`, `styles.css`,
  screenshots) used to design the UI; not loaded at runtime.
