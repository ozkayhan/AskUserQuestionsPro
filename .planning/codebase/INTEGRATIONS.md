---
analysis_date: 2026-07-16
last_mapped_commit: 947e12628a1c5d5e9620539381d274a8c053053d
---

# External Integrations

**Analysis Date:** 2026-07-16

## Host APIs

**Claude Code:**
- `hooks/askuserquestionspro-bridge.mjs` consumes Claude `PreToolUse` stdin for native `AskUserQuestion` calls and returns the hook-specific JSON contract from `hooks/hook-output.js`.
- `bin/install.js` adds/removes the idempotent hook entry in `~/.claude/settings.json`.
- `ASKUI_FORCE_MCP` optionally directs Claude to the MCP path instead of the native hook path.

**Codex CLI / ChatGPT Desktop:**
- `bin/cli.js` registers `mcp-server/askuserquestionspro-mcp.mjs` through the host's `codex mcp` command and deploys `skill/askpro/SKILL.md` to the host-native skill directory.
- Codex `request_user_input` cannot receive answers back through a `PreToolUse` hook, so the supported integration is MCP plus skill guidance rather than native result rewriting.
- `lib/host-platforms.cjs` discovers host executables, including bundled macOS app paths.

## Local HTTP Integration

- `server/server.js` binds only to `127.0.0.1` on `ASKUSER_PORT` or port `4517`.
- `lib/bridge-client.mjs` calls `/health`, `/current`, and `/ask`, starts `server/server.js` on demand, waits for a pending round, and opens the local browser URL.
- `web/live.js` connects to `/events` via Server-Sent Events and posts browser answers to `/answer`.
- `docs/api.md` documents the HTTP contracts; no remote HTTP API or authentication provider is used.

## MCP

- `mcp-server/askuserquestionspro-mcp.mjs` implements JSON-RPC 2.0 over stdio for `initialize`, `tools/list`, `tools/call`, `ping`, and cancellation notifications.
- The `ask` tool validates input through `lib/question-contract.cjs`, calls the local bridge, and returns both JSON text content and MCP structured content.
- Supported protocol versions are declared in the MCP server; failure responses recommend the host-native fallback.
- `.mcp.json` is an empty local project configuration; host-specific registration is performed by the installer rather than checked into this file.

## Browser/Font Services

- React, ReactDOM, and Babel are local vendored assets in `web/vendor/`; application operation does not require npm or a remote JavaScript CDN.
- `web/index.html` preconnects to Google Fonts, and `web/themes.js` / `web/settings-schema.js` may load theme fonts from `fonts.googleapis.com` at runtime. The UI has local fallback fonts for offline use.

## Storage and State

- There is no database, cache, cloud storage, auth provider, webhook, or telemetry service.
- Pending questions and answers are in memory inside `server/bridge.js`; only one round is allowed at a time.
- UI settings persist to `${XDG_CONFIG_HOME}/askuserquestionspro/settings.json` (or `~/.config/...`) through `lib/settings.js` and `lib/atomic-write.cjs`.

## CI/CD and Distribution

- `.github/workflows/ci.yml` runs lint, format, shellcheck, audit, and tests on GitHub Actions.
- `.github/workflows/release.yml`, `.changeset/`, and `@changesets/cli` publish releases to npm.
- `install.sh` can download a GitHub source archive; `reinstall.sh` and `uninstall.sh` manage host artifacts and the shared runtime.

*Integration audit: 2026-07-16*
