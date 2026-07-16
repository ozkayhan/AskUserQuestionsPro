---
analysis_date: 2026-07-16
last_mapped_commit: 947e12628a1c5d5e9620539381d274a8c053053d
---

# Technology Stack

**Analysis Date:** 2026-07-16

## Languages

**Primary:**

- JavaScript (CommonJS and ES modules) for the Node runtime, CLI, bridge, MCP server, hooks, and browser application.
- JSX embedded in `web/*.js`, transpiled by Babel in the browser.

**Secondary:**

- POSIX shell in `install.sh`, `uninstall.sh`, and `reinstall.sh`.
- Markdown and JSON for documentation, skill guidance, eval cases, changesets, and configuration.

## Runtime

**Environment:**

- Node.js `>=18` (`package.json`) using Node built-ins such as `node:http`, `node:fs`, `fetch`, `AbortController`, `node:test`, and ESM support.
- Browser runtime for `web/index.html` and the React UI served by the local bridge.

**Package Manager:**

- npm; `package-lock.json` is present and lockfile version 3.
- No production `dependencies` are declared; runtime code is intentionally zero-dependency.

## Frameworks and Tooling

- Raw `node:http` server in `server/server.js`; no Express or server framework.
- React and ReactDOM are vendored UMD builds in `web/vendor/`.
- Babel is vendored as `web/vendor/babel.min.js` and compiles JSX at page load; there is no frontend build step.
- Native `node:test` is the test runner (`package.json`, `test/*.test.js`).
- ESLint 9 flat config (`eslint.config.js`) and Prettier 3 provide static checks.
- `@changesets/cli` manages versioning and publication through `.github/workflows/release.yml`.

## Key Development Dependencies

- `@babel/core`, `@babel/eslint-parser`, and `@babel/preset-react` parse browser JSX for linting.
- `eslint-plugin-react-hooks` enforces React hook rules in `web/**/*.js`.
- `@eslint/js`, `globals`, `eslint-config-prettier`, and `prettier` provide lint/format checks.
- `@changesets/cli` drives `npm run changeset`, `npm run version`, and `npm run release`.

## Configuration

- `package.json` defines package metadata, Node engine, npm scripts, executable bins, and the published file allowlist.
- Environment variables are read directly by `server/server.js`, `lib/bridge-client.mjs`, `lib/settings.js`, `bin/cli.js`, and the shell installers: `ASKUSER_PORT`, `ASKUI_FORCE_MCP`, host executable overrides, `ASKUSER_TARGET`, and `XDG_CONFIG_HOME`.
- `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, and `.github/workflows/ci.yml` define quality gates.
- `web/settings-schema.js` is the browser-side settings schema; `lib/settings.js` persists validated settings atomically.

## Platform Requirements

- Development: Node.js 18+ and npm; macOS, Linux, and Windows paths are handled by `lib/host-platforms.cjs` and `lib/bridge-client.mjs`.
- Browser: a modern browser capable of EventSource, fetch, and the vendored React/Babel runtime.
- Host integrations: Claude Code and/or Codex CLI/ChatGPT Desktop, selected by `--target auto|all|claude|codex` in `bin/cli.js` and the installers.
- Distribution: npm package or `install.sh`; the package ships the bridge, MCP server, skills, web assets, and shell helpers.

_Stack analysis: 2026-07-16_
