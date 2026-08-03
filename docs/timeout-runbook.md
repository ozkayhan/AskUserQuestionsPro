# Long-round timeout runbook

Use this runbook when the browser closes during a multi-question round or a
Codex/Claude call ends after a repeatable wall-clock interval.

## Scope and current contract

Read redacted `boundary`, `deadlineOwner`, `reason`, and `elapsedMs` together. Attachment loss is detached (recover with `resume`), not cancelled. Deterministic tests prove this local contract only; authenticated Claude Code and Codex evidence is required before making host timeout claims.

The application timeout is one hour in the shared bridge client. The HTTP server
sets `requestTimeout = 0`, and the bridge is localhost-only. MCP progress
heartbeats are optional liveness notifications; they do not override a host’s
own tool-call deadline. Therefore a close near five minutes must be measured at
the host boundary instead of “fixed” by increasing the application constant.

The supported recovery paths are:

- Either MCP host: call `mcp__askuserquestionspro__resume` with the original
  request id or exact durable round id after an unexpected host disconnect,
  before creating a new round. Selector-less recovery is rejected.
- If a new ask reports `round_in_progress` and the original request id is not
  available, call `mcp__askuserquestionspro__list_recoverable_rounds` and use
  the exact `roundId` only for a `detached` or `reconnecting` round. The listing
  is redacted and contains no question text, answers, or capabilities.
- Codex: call `request_user_input` natively if resume reports no available
  round or the MCP round was explicitly cancelled.
- Claude Code: call native `AskUserQuestion` if the hook cannot complete.

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
structured result. Its resume case destroys a host HTTP connection, keeps the
browser round pending, starts a fresh MCP process, and verifies the exact answer
is returned. It proves the local recovery wire contract, not Claude's
undocumented deadline.

## Read lifecycle evidence

Lifecycle lines begin with `[askuser:lifecycle]` and contain redacted JSON. A
healthy round normally follows:

```text
round_started → ask_received → round_registered → browser_opened
→ answer_received → round_finished(reason=completed)
```

The first terminal event is the ownership clue:

| Evidence                                               | Meaning                                                                      | Next action                                                         |
| ------------------------------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `host_abort` or `round_finished` with `host_cancelled` | Host ended the JSON-RPC/hook call                                            | Use the host-native fallback; record host/version and elapsed time  |
| `ask_response_closed` with `host_disconnect`           | Caller connection closed before the browser answered                         | Inspect host process logs and retry with the native fallback        |
| `host_detached` followed by `round_resumed`            | Host connection ended, but the browser round remains bounded and recoverable | Call MCP `resume`; do not start a duplicate `ask` round             |
| `bridge_cancelled` with `browser_disconnect`           | Browser connection/round owner was lost                                      | Reopen the flow and check SSE/browser console state                 |
| `round_finished` with `application_timeout`            | Shared one-hour application deadline                                         | Inspect why the browser remained unanswered for an hour             |
| `process_exit`                                         | Bridge, hook, or MCP process exited                                          | Preserve stderr and run `doctor`; inspect startup/permission errors |
| no lifecycle terminal event                            | Evidence gap or host killed the process before flush                         | Re-run with stderr capture and inspect host cancellation logs       |

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

The Claude hook wire path was also verified with 15 questions and a 12-second
delayed answer, producing the expected `PreToolUse` allow payload. A full
Claude model session could not be run in this environment because the installed
CLI reports `Not logged in`; that is an authentication limitation, not evidence
of a Claude timeout. The Codex CLI 0.144.4 reproduction is recorded: its MCP connection closed at 300s
despite `tool_timeout_sec = 3600`. In the verified run the lifecycle recorded
`host_detached` at `elapsedMs: 300991`; a fresh Codex process called `resume`
56 seconds later and received all 15 answers, followed by
`round_finished(reason=completed)`. The detached/resume path is the supported
mitigation for that host boundary, while the one-hour TTL remains the local
application deadline.

For the current evidence boundary and owner/environment/next-gate fields, see
the [v1.1.1 release handoff](evidence/v1.1.1-release-handoff.md). Historical
timeout rationale is retained in [decisions.md](decisions.md) and the archived
v1.1 milestone sources.
