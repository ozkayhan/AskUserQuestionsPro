---
analysis_date: 2026-07-16
last_mapped_commit: 947e12628a1c5d5e9620539381d274a8c053053d
---

# Testing Patterns

**Analysis Date:** 2026-07-16

## Test Framework

- Runner: Node's built-in `node:test`; no Jest, Vitest, Mocha, or test config.
- Assertions: `node:assert` and `node:assert/strict`.
- Whole suite: `npm test` (`node --test`).
- Single file: `node --test test/bridge.test.js` or another `test/*.test.js` path.
- CI runs `npm ci` and `npm test` on Node 18, 20, and 22 via `.github/workflows/ci.yml`.

## Test Organization

- Tests are a flat `test/` tree with 25 `*.test.js` files; names map to modules, surfaces, or invariants.
- Pure logic is isolated in `test/answer-map.test.js`, `test/bridge.test.js`, `test/install.test.js`, `test/hook-output.test.js`, `test/settings-schema.test.js`, and `test/themes.test.js`.
- Integration/wire behavior is covered by `test/server.test.js`, `test/bridge-client.test.js`, `test/mcp-server.test.js`, `test/cli.test.js`, and `test/shell-lifecycle.test.js`.
- Accessibility and component behavior are covered by `test/views-a11y.test.js`, `test/views.test.js`, `test/settings-panel.test.js`, and `test/ui-kit.test.js`.
- `evals/askpro-skill-cases.json` supplies contract cases consumed by `test/skill-evals.test.js`.

## Test Structure and Isolation

- Files use `test('description', () => {})`, with `describe`/`it` where nested grouping improves readability.
- Assertions are direct and contract-focused; HTTP tests use real local server modules and poll helpers rather than arbitrary sleeps.
- `test/helpers/isolation.js` provides `withClean(t, fn)` to snapshot/restore `AnswerMap` state and relevant environment variables in `t.after`.
- `server.test.js` sets `XDG_CONFIG_HOME` to a temporary directory before loading the server so disk settings cannot leak into a developer machine.
- Temporary home/config directories are created with `fs.mkdtempSync` and removed in `finally` blocks in installer/CLI tests.

## Coverage Focus

- Validation boundary cases include malformed options, length limits, invalid types, scale/ranking rules, and recursive tree depth/labels.
- Contract R tests cover stale round IDs, concurrent `/ask`, disconnect cancellation, and answer-shape rejection.
- Settings tests cover self-healing reads, atomic writes, lock/concurrency behavior, and disk failures.
- MCP tests cover JSON-RPC lifecycle, protocol negotiation, cancellation, schema, structured output, and error metadata.
- Browser tests cover typed answer mapping, navigation, theme tokens, settings, and accessibility annotations.

## Mocking and External Boundaries

- The suite favors pure helpers and local modules over broad mocking.
- Filesystem and environment boundaries are isolated with temp paths and process restoration.
- Host binaries are replaced with temporary shell scripts in `test/cli.test.js` and `test/host-platforms.test.js` to verify command construction without touching real host state.
- The bridge/server tests use the real local HTTP endpoints; network services and databases are not part of the application.

## CI Quality Gates

- `npm run lint` and `npm run format:check` run in the CI lint job.
- Shell scripts are checked with ShellCheck.
- `npm audit --audit-level=high --omit=dev` checks production dependency risk; there are no runtime dependencies.
- GitHub Actions checkout/setup-node actions are SHA-pinned in `.github/workflows/ci.yml`.

## Adding Tests

- Place a regression beside the closest existing contract file in `test/`.
- Prefer a pure unit test for answer/validation/state logic and a real HTTP/MCP test for wire contracts.
- Use `withClean` for any test that mutates `process.env`, global answer-map enablement, or shared bridge state.
- Run the focused file first, then `npm test`, lint, and format checks.

_Testing analysis: 2026-07-16_
