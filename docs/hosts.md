# Host lifecycle guide

This page records host-facing contracts and verified limitations. It is kept
separate from the bridge API because host processes can impose deadlines that
the localhost server cannot observe or change.

## Codex

Codex uses the MCP stdio server and the `askpro` skill. Inspect the active
registration with:

```bash
codex mcp get askuserquestionspro --json
```

The local server keeps the tool call pending for up to one hour. The installer
also writes `tool_timeout_sec = 3600` to the Codex MCP registration. When Codex
supplies an MCP progress token, the server sends periodic progress
notifications while the browser round is waiting. This helps a host recognize
that the request is still active, but it cannot override an undocumented host
wall-clock deadline.

The real Codex CLI 0.144.4 check in Phase 7 reproduced a hard disconnect at
300 seconds. A requestId-bearing round is now detached and kept in the browser
bridge for up to one hour; call the MCP `resume` tool before starting a new
round to collect its answer. An explicit Codex cancellation remains terminal.
The actionable native fallback is `request_user_input` when resume reports no
available round.

## Claude Code

Claude can use the same MCP server for unlimited/richer rounds. Its native
`AskUserQuestion` path is intercepted by the hook where configured; hook
failure exits cleanly so Claude can use its native picker. The Claude hook wire
path was verified with 15 questions and a delayed answer, producing the normal
`PreToolUse` allow payload. A full model session was unavailable because the
installed CLI was not authenticated, so no Claude-specific host deadline is
inferred from that limitation. Claude MCP disconnects use the same bounded
detached/resume path; hook requests without an MCP host requestId preserve
native fallback behavior.

## Terminal reason guide

| Observed reason                          | Meaning                                            | Action                                                            |
| ---------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------- |
| `completed`                              | Browser answers reached the host process.          | Continue normally.                                                |
| `host_cancelled`                         | The host sent cancellation or aborted its request. | Use the host-native input tool or retry.                          |
| `application_timeout`                    | The bridge's configured one-hour deadline elapsed. | Inspect lifecycle timing and retry; this is not a host deadline.  |
| `bridge_error`                           | HTTP, validation, startup, or protocol failure.    | Read the typed error and fix the reported boundary.               |
| `browser_disconnect` / `host_disconnect` | A client connection ended before completion.       | Reopen the round; investigate the first terminal lifecycle event. |
# Host acceptance and support evidence

Claude Code and Codex are Tier 1 adapters with separate framing and fallback semantics. Local fake-host and bridge integration evidence does not establish authenticated live-host support. The current environment has no authenticated, version-pinned acceptance sessions; live rows remain `Unavailable`.

## Authenticated acceptance procedure

For each host, record the exact executable version, installation/configuration scope, date, timeout/deadline owner, cancellation behavior, stdout/stderr behavior, and redacted lifecycle IDs. Never record question or answer text.

1. Start a 15-question idle round and record lifecycle status without content.
2. Disconnect the host transport, reconnect with the exact request/round selector, and verify the immutable result.
3. Restart the bridge, verify restart-shaped recovery and exact selector rejection for stale material.
4. Run explicit cancellation and verify it is terminal and idempotent.
5. Verify result replay and delivery acknowledgement retries.

Claude Code hook procedure (version-pinned): invoke the installed `PreToolUse` AskUserQuestion path, capture the hook exit/stdout/stderr and bridge lifecycle projection, and verify native fallback on timeout/failure. Codex MCP procedure (version-pinned): invoke `ask` over stdio, close stdin for detach, start a new MCP process for exact resume, then exercise cancel/result/ack.

Local prerequisite commands are `node --test test/fake-host-conformance.test.js test/hook-output.test.js test/mcp-long-round.test.js` and `node --test test/tier1-acceptance.test.js`. Authenticated host rows must remain unavailable until the manual procedure is completed; do not infer support from MCP discoverability or hook shape.
