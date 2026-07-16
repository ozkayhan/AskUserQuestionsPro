---
analysis_date: 2026-07-16
last_mapped_commit: 947e12628a1c5d5e9620539381d274a8c053053d
---

# Codebase Structure

**Analysis Date:** 2026-07-16

## Directory Layout

```text
askuserquestionspro/
├── bin/                 # npm CLI and installation logic
├── hooks/               # Claude PreToolUse adapter and output shaping
├── lib/                 # shared bridge, validation, settings, logging, platform helpers
├── server/              # localhost HTTP/SSE server and Bridge coordinator
├── mcp-server/          # JSON-RPC MCP stdio server
├── web/                 # no-build React UI, pure answer logic, themes, CSS, vendored assets
├── skill/askpro/        # host-distributed guidance skill
├── test/                # 25 Node test files plus isolation helper
├── docs/                # maintained architecture/API/testing docs and archived plans
├── evals/               # skill/contract evaluation cases
├── .github/workflows/   # CI and Changesets release workflows
├── .changeset/          # pending release notes and Changesets config
├── install.sh           # source installer
├── reinstall.sh         # reinstall helper
├── uninstall.sh         # cleanup helper
├── package.json         # npm metadata, scripts, bins, publish allowlist
└── README.md            # user-facing installation and usage guide
```

## Directory Purposes

**`lib/`:** Shared runtime seams. `lib/bridge-client.mjs` is the host-facing transport client; `lib/question-contract.cjs` owns validation; `lib/settings.js` and `lib/atomic-write.cjs` own settings persistence; `lib/host-platforms.cjs` owns host discovery.

**`server/`:** `server/server.js` owns HTTP routes, SSE, static serving, settings injection, and request limits. `server/bridge.js` owns pending-round state and round identity.

**`web/`:** `web/app.js` owns top-level flow state; `web/views.js` renders question types and review; `web/live.js` owns SSE/answer transport; `web/answer-map.js` is pure answer/state logic; `web/settings-schema.js`, `web/settings-panel.js`, and `web/themes.js` own settings/theme behavior.

**`test/`:** Flat `*.test.js` files, generally named after the module or contract they cover. `test/helpers/isolation.js` protects tests that mutate process/global state.

**`docs/`:** The root Markdown files are maintained reference docs; `docs/archive/` contains archived planning/audit material and is excluded from lint/format scope.

## Key File Locations

**Entry points:** `bin/cli.js`, `server/server.js`, `mcp-server/askuserquestionspro-mcp.mjs`, `hooks/askuserquestionspro-bridge.mjs`, and `web/index.html`.

**Configuration:** `package.json`, `package-lock.json`, `eslint.config.js`, `.prettierrc.json`, `.mcp.json`, `.github/workflows/ci.yml`, and `.github/workflows/release.yml`.

**Core logic:** `server/bridge.js`, `lib/bridge-client.mjs`, `lib/question-contract.cjs`, `web/answer-map.js`, `lib/settings.js`, and `web/settings-schema.js`.

**Tests:** `test/server.test.js`, `test/bridge.test.js`, `test/bridge-client.test.js`, `test/mcp-server.test.js`, `test/answer-map.test.js`, and the other flat files under `test/`.

## Naming Conventions

- Runtime modules use descriptive kebab-free lowercase names such as `bridge-client.mjs`, `question-contract.cjs`, and `settings-panel.js`.
- Tests use the source/contract name followed by `.test.js`.
- Browser React components and helpers are co-located in flat files rather than one component per directory.
- CommonJS is used by `.js`/`.cjs` files; ESM is explicit in `.mjs` files.

## Where to Add New Code

- New bridge/API behavior: `server/server.js`, `server/bridge.js`, or `lib/question-contract.cjs`, with a matching `test/*.test.js` contract test and `docs/api.md` update.
- New host adapter/install behavior: `lib/host-platforms.cjs`, `bin/cli.js`, `bin/install.js`, or `hooks/`, with host isolation tests.
- New question type or answer behavior: `web/answer-map.js`, `web/ui-kit.js`, `web/views.js`, and `web/app.js`, plus pure tests and accessibility coverage.
- New UI settings: `web/settings-schema.js`, `web/settings-panel.js`, `lib/settings.js`, and settings/server tests.
- New user-facing operational behavior: update `README.md`, relevant `docs/*.md`, and add a `.changeset/*.md` file when release-worthy.

_Structure analysis: 2026-07-16_
