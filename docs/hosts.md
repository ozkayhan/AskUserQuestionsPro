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

The local server keeps the tool call pending for up to one hour. When Codex
supplies an MCP progress token, the server sends periodic progress
notifications while the browser round is waiting. This helps a host recognize
that the request is still active, but it cannot override an undocumented host
wall-clock deadline. The live 1/5/10-minute Codex matrix remains a Phase 7
acceptance task.

If Codex cancels the tool, the round is cancelled and the result is not
replaced with a false successful answer. The actionable fallback is Codex's
native `request_user_input` for a shorter or simpler question set.

## Claude Code

Claude can use the same MCP server for unlimited/richer rounds. Its native
`AskUserQuestion` path is intercepted by the hook where configured; hook
failure exits cleanly so Claude can use its native picker. The equivalent live
long-round matrix and any Claude-specific deadline are not assumed from the
Codex result and remain explicitly tracked for Phase 7.

## Terminal reason guide

| Observed reason                          | Meaning                                            | Action                                                            |
| ---------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------- |
| `completed`                              | Browser answers reached the host process.          | Continue normally.                                                |
| `host_cancelled`                         | The host sent cancellation or aborted its request. | Use the host-native input tool or retry.                          |
| `application_timeout`                    | The bridge's configured one-hour deadline elapsed. | Inspect lifecycle timing and retry; this is not a host deadline.  |
| `bridge_error`                           | HTTP, validation, startup, or protocol failure.    | Read the typed error and fix the reported boundary.               |
| `browser_disconnect` / `host_disconnect` | A client connection ended before completion.       | Reopen the round; investigate the first terminal lifecycle event. |
