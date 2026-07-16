# Timeout and Host-Lifecycle Research

**Research mode:** Inline brownfield investigation after delegated researchers stalled
**Date:** 2026-07-16

## Observed Contracts

- `mcp-server/askuserquestionspro-mcp.mjs` starts one `askBridge()` call with `timeoutMs: 60 * 60 * 1000`, waits for `/current` for 5 seconds only as a registration race guard, opens the browser, then awaits the HTTP response.
- `hooks/askuserquestionspro-bridge.mjs` uses the same one-hour round timeout and falls back silently to native Claude behavior on any error.
- `server/server.js` explicitly sets `server.requestTimeout = 0`, so Node's default five-minute request timeout should not close `/ask`.
- The `/ask` response remains open until the browser posts `/answer`. If the host-side HTTP client disconnects, the response `close` handler calls `bridge.cancel('client disconnected', myId)`, which closes the browser's round.
- Browser `/events` uses SSE with a 25-second comment ping, so the browser-to-server stream has an explicit keepalive.
- `server/bridge.js` is single-flight and in-memory; process restart or cancellation loses the round.
- MCP cancellation aborts the round controller. JSON-RPC `tools/call` stays pending until `askBridge()` resolves or its caller cancels.

## Leading Hypotheses

| Rank | Hypothesis | Evidence | Confidence |
|------|------------|----------|------------|
| 1 | Codex or its MCP client imposes an approximately five-minute tool-call/request deadline; the `/ask` HTTP connection drops, and the server's `close` handler intentionally cancels the round | App timeouts are one hour and Node request timeout is disabled; observed browser closure is consistent with `/ask` disconnect | High |
| 2 | MCP transport/process lifecycle kills or restarts the stdio server while `tools/call` is pending | The result is returned only after the browser answers; a host watchdog or process supervisor can terminate a long-silent call | Medium |
| 3 | A proxy/socket idle timeout exists outside the local Node server | SSE has a ping, but the long-lived `/ask` response has no application-level progress/heartbeat | Medium |
| 4 | Browser SSE or UI state fails independently | Possible, but the reported fixed-duration closure and server-side `/ask` ownership make it a secondary hypothesis | Low/medium |
| 5 | The 5-second `/current` race guard is the cause | It is best-effort and the code continues waiting for `askPromise`; it should not close a registered round | Low |

## Deterministic Reproduction Matrix

1. Run the bridge in the foreground and capture stderr; submit 15 mixed questions through Codex MCP and leave the UI idle for 6+ minutes before answering.
2. Repeat through Claude's native hook with the same question set and idle profile.
3. Run the MCP server directly with a scripted JSON-RPC client that keeps `tools/call` open, then answer through `/answer` after 1, 5, and 10 minutes.
4. Deliberately destroy the `/ask` client connection and verify that the server records a host disconnect and the browser receives a cleared round.
5. Keep the `/events` SSE connection open while the `/ask` request is idle; separately disable the SSE ping to isolate browser transport behavior.
6. Record `requestId`, bridge round id, host, process id, timestamps for submit/register/browser-open/answer/response-close/abort/timeout, and whether `/ask` returned a response.

## Required Instrumentation

- Give every round a correlation record containing host adapter, JSON-RPC id/request id, bridge round id, process id, start time, and terminal reason.
- Log structured lifecycle events to stderr without question contents or answers: `ask_received`, `round_registered`, `browser_opened`, `sse_connected`, `answer_received`, `ask_response_closed`, `host_abort`, `bridge_cancelled`, `round_timeout`, and `mcp_response_sent`.
- Distinguish `TimeoutError`, caller abort, HTTP socket close, server cancellation, browser disconnect, and process exit. The current hook intentionally catches all errors and therefore hides the distinction from users.
- Add a diagnostic mode or bounded ring buffer so ordinary users are not flooded while support can request evidence.

## Fix Options to Evaluate

### Preferred investigation order

1. Prove which connection closes first and whether Codex sends cancellation or simply disappears.
2. If the host deadline is inactivity-based, send standards-compliant MCP progress/keepalive notifications if the client supports them and test whether that resets the deadline.
3. If the host has a hard wall-clock deadline, decouple the long browser interaction from a single pending MCP call: introduce a resumable round/ticket protocol or guided chunking that returns before the host deadline and resumes safely.
4. Preserve the current one-call UX for hosts that support long calls; use a clearly documented fallback for hosts that cannot.

Do not simply increase the one-hour constant or remove cancellation: that would hide the boundary while leaving the host connection failure and could strand in-memory rounds.

## Success Evidence

- A 15-question Codex round remains usable after at least 10 minutes of user idle time and completes with the correct answer map.
- The same test passes through Claude Code, or a documented host limitation is proven with a deterministic fallback.
- Forced host disconnects produce an explicit, recoverable diagnostic and never resolve or cancel a newer round.
- Automated tests cover the lifecycle events and all terminal reasons; a manual wire test covers the real host boundary.
