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
  `prettier`, `eslint-config-prettier`, `@babel/core`, `@babel/eslint-parser`,
  `@babel/preset-react`, `eslint-plugin-react-hooks`. Not shipped in the npm
  package. The Babel + react-hooks packages enable ESLint to parse and lint the
  JSX browser files in `web/`.

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
  - `lint` (`ci.yml`): `npm ci` → ESLint + Prettier check + `shellcheck install.sh reinstall.sh` + `npm audit --audit-level=high --omit=dev` on Node 20. `shellcheck` runs on every CI invocation so shell-quoting regressions are caught machine-side.
  - `test` (`ci.yml`): `npm ci` + `npm test` matrix on Node `18`, `20`, `22` (`fail-fast: false`).
  - `release` (`release.yml`): Changesets action — merges Version Packages PRs and runs `changeset publish` + creates a GitHub Release. The job has `id-token: write` and uses npm trusted publishing through GitHub OIDC.
  - Workflow action pins: `actions/checkout` and `actions/setup-node` are pinned to SHA digests (not floating tags) to prevent supply-chain substitution attacks.
- **Linting/formatting:** ESLint 9 (flat config `eslint.config.js`):
  - Node files (`**/*.{js,cjs,mjs}` excluding `web/`): `@eslint/js` recommended + `no-empty { allowEmptyCatch: false }` (all former silent-swallow catch blocks are now errors).
  - Browser files (`web/**/*.js` excluding `web/vendor/`): parsed by `@babel/eslint-parser` with `@babel/preset-react`; rules: `react-hooks/rules-of-hooks` (error), `react-hooks/exhaustive-deps` (warn), `no-empty { allowEmptyCatch: false }`.
  - Prettier 3 (`.prettierrc.json`) compat via `eslint-config-prettier`.
- **Release management:** Changesets (`@changesets/cli`). Workflow: add a changeset → merge → bot opens Version Packages PR → merge that → GitHub Actions publishes to npm through trusted OIDC publishing. A local `npm publish` is not the default path; see [release.md](release.md).
- **Packaging:** npm. `bin` exposes two executables:
  - `askuserquestionspro` → `bin/cli.js`
  - `askuserquestionspro-mcp` → `mcp-server/askuserquestionspro-mcp.mjs`
  - `files` whitelist: `bin/ hooks/ server/ lib/ mcp-server/ web/ skill/`, the
    install/uninstall/reinstall scripts, `README.md`, and `LICENSE`.
    Repository-only planning, test, documentation, and local `.codex/` workspace
    files are intentionally excluded from the published artifact; the package
    boundary is regression-tested with `npm pack --dry-run --json`.

## npm scripts

| Script         | Command                                       | Purpose                                               |
| -------------- | --------------------------------------------- | ----------------------------------------------------- |
| `test`         | `node --test`                                 | Run the full test suite                               |
| `serve`        | `node server/server.js`                       | Start the bridge server in foreground                 |
| `mcp`          | `node mcp-server/askuserquestionspro-mcp.mjs` | Run the MCP stdio server                              |
| `install-hook` | `node bin/cli.js install`                     | Auto-detect hosts; register adapters, MCP, and skills |
| `lint`         | `eslint .`                                    | Lint all non-excluded source files                    |
| `format`       | `prettier --write .`                          | Auto-format maintained source and project docs        |
| `format:check` | `prettier --check .`                          | Check maintained source/docs (used in CI)             |
| `changeset`    | `changeset`                                   | Add a changeset for release tracking                  |
| `version`      | `changeset version`                           | Bump versions per pending changesets                  |
| `release`      | `changeset publish`                           | Publish to npm (run by release.yml)                   |

## Config / environment

- `ASKUSER_PORT` — bridge server port (default `4517`). Read by `server/server.js`,
  `lib/bridge-client.mjs`, and `bin/cli.js`.
- `ASKUI_FORCE_MCP` — if set, the hook **denies** native `AskUserQuestion`
  calls and tells Claude to use `mcp__askuserquestionspro__ask` instead
  (Claude-only opt-in; it does not intercept Codex `request_user_input`). Read by
  `hooks/askuserquestionspro-bridge.mjs`.
- `ASKUI_CLAUDE_BIN` / `ASKUI_CODEX_BIN` — override executable discovery for
  host install, doctor, and uninstall operations.
- `ASKUSER_TARGET` — default shell-script target when `--target` is omitted;
  accepted values are `auto`, `all`, `claude`, and `codex`.
- `XDG_CONFIG_HOME` — base dir for the persisted settings file
  (`$XDG_CONFIG_HOME/askuserquestionspro/settings.json`, default
  `~/.config`). Read by `lib/settings.js`.
