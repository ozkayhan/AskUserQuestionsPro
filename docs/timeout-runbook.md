# Long-round timeout runbook

Use this runbook when the browser closes during a multi-question round or a
Codex/Claude call ends after a repeatable wall-clock interval.

## Scope and current contract

The application timeout is one hour in the shared bridge client. The HTTP server
sets `requestTimeout = 0`, and the bridge is localhost-only. MCP progress
heartbeats are optional liveness notifications; they do not override a host’s
own tool-call deadline. Therefore a close near five minutes must be measured at
the host boundary instead of “fixed” by increasing the application constant.

The supported recovery paths are:

- Codex: call `request_user_input` natively if the MCP round is cancelled.
- Claude Code: call native `AskUserQuestion` if the hook cannot complete.
- Either host: rerun the MCP question set after the browser/server has cleaned up.

## Reproduce safely

1. Use at least 15 questions with distinct labels and record the host, model,
   client version, OS, and start time.
2. Run one round through the Codex MCP tool and one through the Claude hook.
3. Leave the browser idle for 1, 5, and 10 minutes before answering. Repeat any
   boundary that closes early.
4. Capture host stderr and the browser’s visible close time. Do not put real
   question or answer text in a bug report.

For a deterministic application-only test that never opens a browser:

```bash
ASKUSER_OPEN_BROWSER=0 npm test -- test/long-round.test.js test/mcp-long-round.test.js
```

The MCP integration test starts the real stdio entrypoint, sends a progress token,
waits for multiple progress notifications, posts a delayed answer, and checks the
structured result. It proves the local wire contract, not a host’s deadline.

## Read lifecycle evidence

Lifecycle lines begin with `[askuser:lifecycle]` and contain redacted JSON. A
healthy round normally follows:

```text
round_started → ask_received → round_registered → browser_opened
→ answer_received → round_finished(reason=completed)
```

The first terminal event is the ownership clue:

| Evidence                                               | Meaning                                              | Next action                                                         |
| ------------------------------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------- |
| `host_abort` or `round_finished` with `host_cancelled` | Host ended the JSON-RPC/hook call                    | Use the host-native fallback; record host/version and elapsed time  |
| `ask_response_closed` with `host_disconnect`           | Caller connection closed before the browser answered | Inspect host process logs and retry with the native fallback        |
| `bridge_cancelled` with `browser_disconnect`           | Browser connection/round owner was lost              | Reopen the flow and check SSE/browser console state                 |
| `round_finished` with `application_timeout`            | Shared one-hour application deadline                 | Inspect why the browser remained unanswered for an hour             |
| `process_exit`                                         | Bridge, hook, or MCP process exited                  | Preserve stderr and run `doctor`; inspect startup/permission errors |
| no lifecycle terminal event                            | Evidence gap or host killed the process before flush | Re-run with stderr capture and inspect host cancellation logs       |

Never infer “the one-hour timeout fired” from a generic host timeout message. The
typed lifecycle reason and elapsed time are the source of truth for the local
application; host claims require host-side evidence.

## Diagnostics

```bash
askuserquestionspro doctor --target all
codex mcp get askuserquestionspro --json
claude mcp get askuserquestionspro
```

Use `ASKUI_CLAUDE_BIN` and `ASKUI_CODEX_BIN` when the host executable is not on
`PATH`. Use `ASKUSER_PORT` only when isolating a local bridge; both the browser
URL and client must use the same port.

## Reporting template

```text
Host/client:
OS + Node:
Question count:
Idle duration:
Browser close time:
Last lifecycle event + reason:
Host stderr excerpt (redacted):
Native fallback result:
```

The unresolved acceptance requirement is a real Codex and Claude run beyond ten
minutes. That matrix is Phase 7 work; local tests must not be presented as proof
of host behavior.
