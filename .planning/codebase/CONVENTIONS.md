---
analysis_date: 2026-07-16
last_mapped_commit: 947e12628a1c5d5e9620539381d274a8c053053d
---

# Coding Conventions

**Analysis Date:** 2026-07-16

## Naming and Modules

- Functions and local variables use `camelCase`; constants use uppercase names such as `MAX_BODY`, `APP_ID`, and `RECONNECT_CAP_MS`.
- Classes use PascalCase (`Bridge`, `TimeoutError`, `BridgeError`); browser components also use PascalCase (`QuestionCard`, `Summary`, `SettingsModal`).
- Files are lowercase descriptive names; tests are `name.test.js`.
- Prefer named exports for ESM and explicit `module.exports` objects for CommonJS modules.
- Keep shared contracts in one module: validation in `lib/question-contract.cjs`, settings in `web/settings-schema.js`, answer decisions in `web/answer-map.js`.

## Formatting and Linting

- Prettier is authoritative (`.prettierrc.json`, `npm run format:check`); source uses semicolons, single quotes in Node code, and two-space indentation.
- ESLint uses flat config in `eslint.config.js`; Node files extend `@eslint/js` recommended rules.
- `no-empty` disallows silent catch blocks; unused variables/args may use a leading underscore where intentionally ignored.
- Browser JSX is parsed by `@babel/eslint-parser`; React hook rules are enforced and exhaustive-deps is a warning.
- `web/vendor/**`, `node_modules/**`, `.context/**`, and `docs/old/**` are excluded from normal lint scope.

## Import Organization

- Node built-ins appear first, followed by project-relative imports.
- ESM modules use explicit `node:` specifiers (`node:child_process`, `node:crypto`, `node:timers/promises`).
- ESM↔CommonJS boundaries use `createRequire(import.meta.url)` where needed, as in `lib/bridge-client.mjs` and the host entry points.
- Browser files rely on globals loaded by `web/index.html` rather than an npm bundler; `/* global ... */` annotations document expected globals.

## Error Handling

- Validate at HTTP/MCP boundaries and return actionable status/error payloads instead of allowing malformed data deeper into the bridge.
- Throw for unexpected local failures; catch at host boundaries to log context and preserve a safe fallback.
- Use typed `BridgeError` and `TimeoutError` in `lib/bridge-client.mjs` when callers need to distinguish HTTP errors from deadlines.
- Use result objects for expected persistence outcomes in `lib/settings.js` (`{ok, value, error}`); callers must check `ok`.
- Guard race-sensitive operations with round IDs and expected IDs (`server/bridge.js`, `/answer`, disconnect cancellation).

## Logging and Comments

- `lib/log.cjs` is the shared stderr logger and should be used when errors are intentionally recovered.
- Comments explain invariants and reasons, especially around race prevention, atomic writes, host fallback, and React state freshness.
- Existing comments may be Turkish or English; preserve local terminology when editing a nearby section.
- Avoid adding speculative abstractions: `planv2.md` explicitly favors small reused, tested chokepoints and a zero-runtime-dependency invariant.

## Function and UI Design

- Guard clauses are common at boundaries; return early for invalid input or unsupported paths.
- Keep pure browser decisions in `web/answer-map.js` so React event handlers remain thin and testable.
- Preserve accessibility semantics in UI changes: ARIA roles/states are asserted by `test/views-a11y.test.js`.
- Preserve keyboard behavior and question-type dispatch in `web/app.js` / `web/views.js` when changing the form flow.

## Tests and Changes

- Add a focused `test/*.test.js` regression for every contract or bug fix; use `test/helpers/isolation.js` when mutating globals or environment variables.
- Run `npm test`, `npm run lint`, and `npm run format:check` before handoff; shell changes also need ShellCheck.
- Release-visible changes use `.changeset/*.md`; update the maintained docs when API or host behavior changes.

*Convention analysis: 2026-07-16*
