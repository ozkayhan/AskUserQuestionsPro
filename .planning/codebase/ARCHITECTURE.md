---
analysis_date: 2026-07-16
last_mapped_commit: 947e12628a1c5d5e9620539381d274a8c053053d
---

# Architecture

**Analysis Date:** 2026-07-16

## Pattern Overview

**Overall:** Local single-process bridge with two host adapters and a browser client.

**Key Characteristics:**

- Claude hook and MCP server converge on the shared `lib/bridge-client.mjs` path.
- `server/bridge.js` is a single-flight in-memory coordinator with monotonic round IDs.
- `server/server.js` exposes a localhost HTTP/SSE boundary and serves the static UI.
- The browser owns type-aware answer state and sends opaque question-text-keyed answers back to the server.
- There is no database, build pipeline, or remote application service.

## Layers

**Host Adapter Layer:**

- Purpose: Translate host-specific invocation and response contracts.
- Contains: `hooks/askuserquestionspro-bridge.mjs`, `hooks/hook-output.js`, and `mcp-server/askuserquestionspro-mcp.mjs`.
- Depends on: shared bridge client and question contract.
- Used by: Claude Code, Codex CLI, and ChatGPT Desktop integrations.

**Bridge Client Layer:**

- Purpose: Start/check the local server, submit rounds, wait for registration, and open the browser.
- Contains: `lib/bridge-client.mjs`.
- Depends on: Node child-process, fetch, timeout, and platform opener APIs.
- Used by both host adapters.

**HTTP/Coordination Layer:**

- Purpose: Validate requests, maintain pending state, stream current rounds, persist settings, and serve assets.
- Contains: `server/server.js`, `server/bridge.js`, `lib/question-contract.cjs`, `lib/settings.js`, and `lib/atomic-write.cjs`.
- Depends on: Node built-ins and browser asset files.
- Used by the bridge client and browser UI.

**Presentation Layer:**

- Purpose: Render questions, navigation, review, settings, themes, accessibility semantics, and answer mapping.
- Contains: `web/index.html`, `web/app.js`, `web/views.js`, `web/live.js`, `web/answer-map.js`, `web/ui-kit.js`, `web/settings-panel.js`, `web/settings-schema.js`, `web/themes.js`, and `web/styles.css`.
- Depends on: vendored React/ReactDOM/Babel and the local HTTP API.

## Data Flow

**Question Round:**

1. Claude invokes the hook or a host sends an MCP `tools/call` to `ask`.
2. The adapter validates/forwards questions through `lib/bridge-client.mjs`.
3. `ensureServer()` starts `server/server.js` if `/health` does not identify the expected app.
4. `POST /ask` calls `Bridge.submitQuestions()` and remains open while the browser answers.
5. `GET /events` broadcasts `{id, questions}` to the browser; `web/app.js` stores local interaction state.
6. `web/answer-map.js` maps typed state to answers keyed by question text.
7. `POST /answer` must carry the owning round ID; `Bridge.provideAnswers()` resolves the waiting request.
8. The hook wraps the result for Claude, or the MCP server returns the MCP tool result.

**State Management:**

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

_Architecture analysis: 2026-07-16_
