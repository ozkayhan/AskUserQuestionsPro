# Tech Stack

## Runtime & language

- **Node.js ≥ 18** (`package.json` `engines.node: ">=18"`). Uses native
  `node:test`, `fetch`/`AbortController`, and ES modules.
- **JavaScript**, mixed module systems:
  - `package.json` `type: "commonjs"` — `.js` files are CommonJS by default
    (`bin/`, `server/`, `hooks/hook-output.js`, `web/*` are browser scripts).
  - `.mjs` files are ES modules: `lib/bridge-client.mjs`,
    `mcp-server/askuserquestionspro-mcp.mjs`, `hooks/askuserquestionspro-bridge.mjs`.

## Dependencies

- **Runtime:** none. `package.json` declares no `dependencies` — everything
  is Node core + browser-vendored libs.
- **Dev (tooling only):** `@changesets/cli`, `eslint`, `@eslint/js`, `globals`,
  `prettier`, `eslint-config-prettier`. Not shipped in the npm package.

## Frontend libraries (vendored, not npm)

Checked into `web/vendor/`, loaded via `<script>` tags in `web/index.html`:

- `react.production.min.js` + `react-dom.production.min.js` — React (UMD globals).
- `babel.min.js` — in-browser JSX transpilation. App files are loaded with
  `type="text/babel"`, so JSX is compiled client-side at runtime (no build step).

Fonts come from Google Fonts, loaded dynamically per theme (see
[frontend.md](frontend.md)).

## Tooling

- **Test runner:** `node --test` (built-in). `npm test` runs the whole
  `test/` suite. No Jest/Mocha/etc.
- **CI:** GitHub Actions — two jobs on every push/PR:
  - `lint` (`ci.yml`): `npm ci` → ESLint + Prettier check + `npm audit --audit-level=high --omit=dev` on Node 20.
  - `test` (`ci.yml`): `npm ci` + `npm test` matrix on Node `18`, `20`, `22` (`fail-fast: false`).
  - `release` (`release.yml`): Changesets action — merges Version Packages PRs and runs `npm publish` + creates GitHub Release.
- **Linting/formatting:** ESLint 9 (flat config `eslint.config.js`, `@eslint/js` recommended + prettier compat) + Prettier 3 (`.prettierrc.json`). `web/` and `web/vendor/` excluded from ESLint.
- **Release management:** Changesets (`@changesets/cli`). Workflow: add a changeset → merge → bot opens Version Packages PR → merge that → auto-publish to npm.
- **Packaging:** npm. `bin` exposes two executables:
  - `askuserquestionspro` → `bin/cli.js`
  - `askuserquestionspro-mcp` → `mcp-server/askuserquestionspro-mcp.mjs`
  - `files` whitelist: `bin/ hooks/ server/ lib/ mcp-server/ web/ install.sh README.md LICENSE`.

## npm scripts

| Script         | Command                                       | Purpose                                |
| -------------- | --------------------------------------------- | -------------------------------------- |
| `test`         | `node --test`                                 | Run the full test suite                |
| `serve`        | `node server/server.js`                       | Start the bridge server in foreground  |
| `mcp`          | `node mcp-server/askuserquestionspro-mcp.mjs` | Run the MCP stdio server               |
| `install-hook` | `node bin/cli.js install`                     | Register hook + MCP in Claude settings |
| `lint`         | `eslint .`                                    | Lint all non-excluded source files     |
| `format`       | `prettier --write .`                          | Auto-format all files                  |
| `format:check` | `prettier --check .`                          | Check formatting (used in CI)          |
| `changeset`    | `changeset`                                   | Add a changeset for release tracking   |
| `version`      | `changeset version`                           | Bump versions per pending changesets   |
| `release`      | `changeset publish`                           | Publish to npm (run by release.yml)    |

## Config / environment

- `ASKUSER_PORT` — bridge server port (default `4517`). Read by `server/server.js`,
  `lib/bridge-client.mjs`, and `bin/cli.js`.
- `ASKUI_FORCE_MCP` — if set, the hook **denies** native `AskUserQuestion`
  calls and tells Claude to use `mcp__askuserquestionspro__ask` instead
  (opt-in "always use the unlimited path"). Read by
  `hooks/askuserquestionspro-bridge.mjs`.
- `XDG_CONFIG_HOME` — base dir for the persisted settings file
  (`$XDG_CONFIG_HOME/askuserquestionspro/settings.json`, default
  `~/.config`). Read by `lib/settings.js`.
