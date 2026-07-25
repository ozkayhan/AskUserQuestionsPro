# Code Map

Start here to navigate. Real paths; "to change X, go to Y".

## Top-level layout

```
.
├── bin/                  CLI + settings-mutation logic
├── hooks/                PreToolUse hook + its output builder
├── mcp-server/           MCP stdio server (the `ask` tool)
├── server/               local bridge HTTP server + Bridge class
├── lib/                  shared client, host adapter, settings, utilities
├── web/                  browser UI (React via in-browser Babel)
├── skill/askpro/         host-neutral MCP usage guidance deployed per host
├── test/                 node:test suite (one file per module)
├── evals/                skill behavior cases (valid and invalid payloads)
├── install.sh            curl|bash installer
├── uninstall.sh          host-aware residue-cleaning uninstaller
├── reinstall.sh          host-aware uninstall + fresh install helper
├── package.json          npm manifest, bin entries, scripts
├── eslint.config.js      ESLint flat config (Node source; web/ excluded)
├── .prettierrc.json      Prettier config
├── .changeset/           Changesets config + pending changesets
├── .github/workflows/    CI (ci.yml: lint + test matrix; release.yml: Changesets publish)
└── docs/                 ← you are here (English, code-verified)
```

## Backend / Node side

| Path                                     | What it is                                                                                                                                                                                                                             | Go here to…                                                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `bin/cli.js`                             | CLI entry (`askuserquestionspro`). Subcommands: `init`, `install`, `uninstall`, `serve`, `mcp`, `settings`, `doctor`, `help`.                                                                                                          | Change CLI commands, install/uninstall flow, `settings` get/set/list, `doctor` health checks.  |
| `bin/install.js`                         | Pure functions `addHook()` / `removeHook()` that mutate a `settings.json` object. Constants `MATCHER='AskUserQuestion'`, `TIMEOUT=3600`.                                                                                               | Change how the hook entry is added/removed or conflict detection.                              |
| `install.sh`                             | Target-aware Bash installer: download → persistent copy → bundled CLI install/doctor → skill verification.                                                                                                                             | Change the `curl \| bash` install path.                                                        |
| `uninstall.sh`                           | Target-aware cleanup and residue verification for Claude/Codex registrations, skills, files, settings, and bridge processes.                                                                                                           | Change standalone uninstall behavior.                                                          |
| `reinstall.sh`                           | Passes the same target through uninstall and a fresh install.                                                                                                                                                                          | Change recovery/reinstall behavior.                                                            |
| `mcp-server/askuserquestionspro-mcp.mjs` | Host-neutral JSON-RPC 2.0 stdio server. Defines `ASK_TOOL`, `RESUME_TOOL`, output schemas, annotations, server instructions, structured results, and pending-before-browser flow.                                                      | Change the `ask`/`resume` tool schema, metadata, result, or MCP protocol handling.             |
| `server/server.js`                       | `node:http` composition root (port `ASKUSER_PORT` or 4517): `/health`, static files, request-error boundary, durable round store, and route-module wiring. Exports `server`, `bridge`.                                                 | Change process/server lifecycle, static serving, or composition.                               |
| `server/http-io.cjs`                     | Shared bounded request-body reader plus JSON and observed-response helpers.                                                                                                                                                            | Change generic HTTP I/O behavior while preserving its tests.                                   |
| `server/round-routes.cjs`                | Active-round, recovery, and SSE route factory; owns SSE clients and broadcasts.                                                                                                                                                        | Change `/current`, `/rounds`, `/events`, `/ask`, `/resume`, `/answer`, `/draft`, or `/cancel`. |
| `server/settings-routes.cjs`             | Settings route factory plus in-process settings cache and preview store.                                                                                                                                                               | Change settings mutation, export, doctor, preview, apply, or reset behavior.                   |
| `server/bridge.js`                       | `Bridge` class: single-flight `_pending` + `_seq`, durable recovery coordination, bounded detach state, and completed-answer cache. Methods `submitQuestions` `peek` `getCurrent` `provideAnswers` `cancel` `detach` `waitForAnswers`. | Change question/answer coordination semantics.                                                 |
| `lib/round-store.cjs`                    | Private versioned per-round snapshot store used by `Bridge` for recoverable lifecycle, drafts, and delivery state. Browser storage is not authoritative.                                                                               | Change recovery persistence, record lookup, expiry cleanup, or quarantine behavior.            |
| `lib/bridge-client.mjs`                  | `ensureServer()` `askBridge()` `resumeBridge()` `cancelBridge()` `waitForPending()` `openBrowser()`. Shared by hook + MCP.                                                                                                             | Change server bootstrap, pending-round recovery, browser opening, or host HTTP calls.          |
| `lib/question-contract.cjs`              | Shared question/option validator used by the HTTP bridge and MCP preflight.                                                                                                                                                            | Change accepted question types, option shape, or validation error messages.                    |
| `lib/host-platforms.cjs`                 | Target parsing, Claude/Codex discovery, MCP CLI argv, manual commands, and host-native skill destinations.                                                                                                                             | Change host selection or installation contracts.                                               |
| `lib/settings.js`                        | Disk persistence for UI settings: `read()` / `write(patch)` / `getPath()`. Atomic write + schema-validated self-heal. File at `~/.config/askuserquestionspro/settings.json`.                                                           | Change settings storage, the config file location, or self-heal behavior.                      |
| `hooks/askuserquestionspro-bridge.mjs`   | Claude-only `PreToolUse` hook. Starts `/ask`, waits for the pending round, opens the browser, and falls back to native Claude behavior on error.                                                                                       | Change Claude hook behavior / the force-MCP opt-in.                                            |
| `hooks/hook-output.js`                   | `buildHookOutput(toolInput, answers)` → the `PreToolUse` allow-decision payload with `updatedInput`.                                                                                                                                   | Change the shape returned to Claude Code.                                                      |
| `skill/askpro/SKILL.md`                  | Guidance installed at `~/.claude/skills/askpro` or `~/.agents/skills/askpro`; prefers MCP for structured interactions and names host-native fallbacks.                                                                                 | Change agent tool-selection guidance.                                                          |

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

There are 32 top-level `test/*.test.js` files, run with `node --test`. Host
coverage is split between `host-platforms.test.js` (selection/discovery/argv/
paths), `cli.test.js` (Codex-only lifecycle isolation), and
`mcp-server.test.js` (instructions, `outputSchema`, and annotations). See
[testing.md](testing.md) for the full inventory.

## Out of scope (not current runtime behavior)

- `docs/archive/` — historical audit reports and workflow plans; not current
  implementation instructions.
