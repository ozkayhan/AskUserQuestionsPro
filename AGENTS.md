<!-- GSD:project-start source:PROJECT.md -->

## Project

**AskUserQuestionsPro Reliability and Documentation Overhaul**

AskUserQuestionsPro is a local browser-based question interface that replaces cramped terminal prompts for Claude Code and Codex. Host adapters submit a question round to a single-user localhost bridge, the browser collects rich answers, and the result is returned to the originating host. This milestone hardens the whole system, with special focus on long-running rounds that currently close unexpectedly in Codex and may also fail in Claude Code.

**Core Value:** Users must be able to complete a long, multi-question round at their own pace without the bridge, browser, or host integration timing out or losing their answers.

### Constraints

- **Compatibility**: Keep Claude Code and Codex integrations working — they are the primary user-facing entry points.
- **Runtime**: Support Node.js 18+ and the existing supported host platforms — the package and installers depend on this baseline.
- **Packaging**: Preserve zero production dependencies and the current distribution contract unless a documented, justified decision changes it.
- **Safety**: Keep the bridge bound to `127.0.0.1` and unauthenticated only within that local single-user model — exposing it remotely would change the threat model.
- **Verification**: Every reliability change must have automated regression coverage and, where it crosses the browser/host boundary, a manual or integration-level verification path.
- **Documentation**: Preserve meaningful historical rationale and architecture decisions while removing stale duplication — cleanup must not erase project knowledge.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- JavaScript (CommonJS and ES modules) for the Node runtime, CLI, bridge, MCP server, hooks, and browser application.
- JSX embedded in `web/*.js`, transpiled by Babel in the browser.
- POSIX shell in `install.sh`, `uninstall.sh`, and `reinstall.sh`.
- Markdown and JSON for documentation, skill guidance, eval cases, changesets, and configuration.

## Runtime

- Node.js `>=18` (`package.json`) using Node built-ins such as `node:http`, `node:fs`, `fetch`, `AbortController`, `node:test`, and ESM support.
- Browser runtime for `web/index.html` and the React UI served by the local bridge.
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

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

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

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## Pattern Overview

- Claude hook and MCP server converge on the shared `lib/bridge-client.mjs` path.
- `server/bridge.js` is a single-flight in-memory coordinator with monotonic round IDs.
- `server/server.js` exposes a localhost HTTP/SSE boundary and serves the static UI.
- The browser owns type-aware answer state and sends opaque question-text-keyed answers back to the server.
- There is no database, build pipeline, or remote application service.

## Layers

- Purpose: Translate host-specific invocation and response contracts.
- Contains: `hooks/askuserquestionspro-bridge.mjs`, `hooks/hook-output.js`, and `mcp-server/askuserquestionspro-mcp.mjs`.
- Depends on: shared bridge client and question contract.
- Used by: Claude Code, Codex CLI, and ChatGPT Desktop integrations.
- Purpose: Start/check the local server, submit rounds, wait for registration, and open the browser.
- Contains: `lib/bridge-client.mjs`.
- Depends on: Node child-process, fetch, timeout, and platform opener APIs.
- Used by both host adapters.
- Purpose: Validate requests, maintain pending state, stream current rounds, persist settings, and serve assets.
- Contains: `server/server.js`, `server/bridge.js`, `lib/question-contract.cjs`, `lib/settings.js`, and `lib/atomic-write.cjs`.
- Depends on: Node built-ins and browser asset files.
- Used by the bridge client and browser UI.
- Purpose: Render questions, navigation, review, settings, themes, accessibility semantics, and answer mapping.
- Contains: `web/index.html`, `web/app.js`, `web/views.js`, `web/live.js`, `web/answer-map.js`, `web/ui-kit.js`, `web/settings-panel.js`, `web/settings-schema.js`, `web/themes.js`, and `web/styles.css`.
- Depends on: vendored React/ReactDOM/Babel and the local HTTP API.

## Data Flow

- Active question state is process memory in `Bridge`; settings are validated JSON on disk.
- The browser keeps transient selections and review state in React state; the server treats submitted answers as opaque.

## Key Abstractions

- `Bridge` in `server/bridge.js`: single-flight state machine; round identity prevents stale answers from resolving a later round.
- `validQuestions` in `lib/question-contract.cjs`: shared validation chokepoint used by HTTP and MCP.
- `AnswerMap` in `web/answer-map.js`: pure type resolution, activation, answer mapping, and tree/ranking/scale helpers.
- `Settings_Schema` in `web/settings-schema.js`: browser/Node-compatible settings source of truth; `lib/settings.js` adds atomic persistence.
- `BridgeError` and `TimeoutError` in `lib/bridge-client.mjs`: typed transport failures for host-facing recovery.

## Entry Points

- `bin/cli.js`: npm CLI for install, uninstall, doctor, serve, mcp, and settings commands.
- `hooks/askuserquestionspro-bridge.mjs`: Claude `PreToolUse` entry point.
- `mcp-server/askuserquestionspro-mcp.mjs`: JSON-RPC stdio entry point.
- `server/server.js`: local HTTP server entry point.
- `web/index.html`: browser entry point and script load order.

## Error Handling and Cross-Cutting Concerns

- Boundary validation returns HTTP 400 or MCP error results; concurrent/stale rounds return HTTP 409.
- Hook failures log and exit successfully so Claude can use its native fallback; MCP failures provide fallback guidance.
- `lib/log.cjs` centralizes non-throwing stderr logging; `server/server.js` guards request disconnects and static traversal.
- `lib/atomic-write.cjs` uses a lockfile, temp file, and rename for settings durability.

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.

<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.

<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.

<!-- GSD:profile-end -->
