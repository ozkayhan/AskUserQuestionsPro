---
analysis_date: 2026-07-16
last_mapped_commit: 947e12628a1c5d5e9620539381d274a8c053053d
---

# Codebase Concerns

**Analysis Date:** 2026-07-16

## Tech Debt and Maintenance Risks

**Mixed module systems:**

- Files under `lib/`, `server/`, `bin/`, and most hooks are CommonJS while bridge/MCP entry points are ESM.
- `createRequire()` bridges the boundary, but new imports must respect the `.js`/`.cjs`/`.mjs` behavior in `package.json` and avoid accidental loader changes.

**No frontend build step:**

- Browser JSX is compiled at runtime by `web/vendor/babel.min.js` and React assets are checked in.
- This keeps distribution dependency-free but increases page startup work and makes vendor upgrades/manual asset provenance a maintenance task.

**Release metadata drift:**

- `package.json` reports version `1.1.0` while the root metadata in `package-lock.json` reports `1.0.0`.
- Any release or install debugging should verify both files and the Changesets state before publishing.

## Security Considerations

**Local unauthenticated HTTP API:**

- `server/server.js` intentionally binds to `127.0.0.1` and `docs/api.md` states there is no auth.
- The localhost boundary is appropriate for a single-user desktop flow, but changing the bind address or exposing port `4517` would expose question content and answer submission without authentication.

**Installer trust boundary:**

- `README.md`, `install.sh`, and `reinstall.sh` support downloading installer/source material from GitHub; these scripts modify global Claude/Codex configuration and skill directories.
- Changes require shell quoting, archive-path, checksum, and cleanup review; CI mitigates some risk through ShellCheck and pinned GitHub Actions but does not verify downloaded release archives here.

**Dynamic font loading:**

- `web/index.html`, `web/themes.js`, and `web/settings-schema.js` contact Google Fonts at runtime.
- This is a privacy/network dependency and must remain optional; preserve local fallback fonts and avoid making question submission depend on font loading.

## Fragile Areas

**Single-flight bridge and round identity:**

- `server/bridge.js`, `server/server.js`, `lib/bridge-client.mjs`, `web/live.js`, and `web/app.js` share the pending round ID contract.
- Late answers, disconnects, concurrent calls, or opening the browser before `/ask` registration can corrupt the flow if IDs or ordering are changed. Keep Contract R tests in `test/server.test.js` and `test/bridge.test.js` green.

**Settings module-load environment:**

- `lib/settings.js` resolves its settings directory when the module loads; tests therefore set `XDG_CONFIG_HOME` before requiring server/settings modules.
- Refactors that change import order or caching can make tests read/write a real user config directory or stale settings.

**Browser state machine:**

- `web/app.js` and `web/views.js` coordinate keyboard navigation, question-type dispatch, summary submission, and modal settings behavior.
- Keep stale-prone decisions in pure `web/answer-map.js`; update `test/views-a11y.test.js` when DOM roles or keyboard behavior change.

## Scaling Limits

- `server/bridge.js` permits one pending question set only; a second caller receives a conflict. This is a deliberate desktop UX constraint, not a multi-user service design.
- Questions/answers are held in memory and `/ask` requests can remain open for up to one hour in `lib/bridge-client.mjs`; process restart loses the active round.
- `server/server.js` caps request bodies at 8 MB, while browser rendering and question-text answer keys will become less practical well before that limit.

## Test Coverage Gaps to Recheck

- The application has broad contract coverage, but external browser behavior is tested through browser-compatible modules rather than a full real-browser E2E workflow.
- Installation tests use fake host executables and temp homes; manual validation is still useful for actual Claude/Codex app versions and macOS bundled executable discovery.
- When adding a new question type, update the shared validator, answer map, views, UI kit, skill/eval cases, API docs, and the corresponding type-specific tests together.

## Operational Guidance

- Run `npm test`, `npm run lint`, `npm run format:check`, and ShellCheck after changes to runtime or installers.
- Preserve the zero-runtime-dependency invariant unless a deliberate packaging decision updates `package.json`, `package-lock.json`, CI audit behavior, and the published file allowlist together.

_Concerns audit: 2026-07-16_
