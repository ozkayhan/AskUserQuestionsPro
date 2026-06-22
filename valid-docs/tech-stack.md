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

- **None.** `package.json` declares no `dependencies` or `devDependencies`.
  Everything is Node core + browser-vendored libs.

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
- **CI:** GitHub Actions (`.github/workflows/ci.yml`) — runs `npm install` +
  `npm test` on Node `18`, `20`, `22` (matrix, `fail-fast: false`), on every
  push and pull request.
- **Packaging:** npm. `bin` exposes two executables:
  - `askuserquestionspro` → `bin/cli.js`
  - `askuserquestionspro-mcp` → `mcp-server/askuserquestionspro-mcp.mjs`
  - `files` whitelist: `bin/ hooks/ server/ lib/ mcp-server/ web/ install.sh README.md LICENSE`.

## npm scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `test` | `node --test` | Run the full test suite |
| `serve` | `node server/server.js` | Start the bridge server in foreground |
| `mcp` | `node mcp-server/askuserquestionspro-mcp.mjs` | Run the MCP stdio server |
| `install-hook` | `node bin/cli.js install` | Register hook + MCP in Claude settings |

## Config / environment

- `ASKUSER_PORT` — bridge server port (default `4517`). Read by `server/server.js`,
  `lib/bridge-client.mjs`, and `bin/cli.js`.
- `ASKUI_FORCE_MCP` — if set, the hook **denies** native `AskUserQuestion`
  calls and tells Claude to use `mcp__askuserquestionspro__ask` instead
  (opt-in "always use the unlimited path"). Read by
  `hooks/askuserquestionspro-bridge.mjs`.
