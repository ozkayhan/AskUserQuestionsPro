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
