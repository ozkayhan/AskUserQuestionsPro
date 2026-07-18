# Phase 08 authenticated lifecycle acceptance

Record only synthetic 15-question runs. Never record question text, answers, local paths, or credentials.

## Claude Code hook

- Installed host version, Node version, OS, and configuration scope: **Unavailable — Claude Code is not installed or available in this environment and will not be part of this acceptance run.**
- Authentication availability (if unavailable, make no claim): Unavailable; no Claude support or timeout conclusion is made.
- Short idle / just below boundary / just above boundary timestamps: Not run.
- Redacted lifecycle JSON: Not available because no Claude host process was available; no synthetic host evidence is claimed.
- Cancellation/response-write observation; resume and exact synthetic-result-once result: Not run.
- Conclusion limited to this installed version: No Claude Code version is supported or certified by this artifact. The existing native-hook integration remains a documented, unverified path until a Claude installation becomes available.

## Codex MCP

- Installed host version, Node version, OS, and configuration scope: Codex CLI **0.144.5**, Node **v22.23.1**, macOS **26.4.1**. Tests ran in an ephemeral `codex exec` process against the current workspace’s local stdio MCP server; the global MCP configuration was not modified. Normal run used `tool_timeout_sec=3600`; deadline run used an explicit `tool_timeout_sec=3` override.
- Authentication availability (if unavailable, make no claim): `codex login status` reported **Logged in using ChatGPT**; `codex doctor` reported configured ChatGPT auth and reachable provider connectivity.
- Short idle / just below boundary / just above boundary timestamps: Normal 15-question run opened at approximately **2026-07-17 09:41 UTC** and completed after browser submission at **09:42:27 UTC** with no unexplained close. Controlled deadline run opened at approximately **09:44:12 UTC**; the configured 3-second MCP tool deadline failed at **09:44:18.801 UTC** with `timed out awaiting tools/call after 3s`. The detached browser round remained available. A fresh Codex process called `resume`, the same 15 synthetic answers were submitted, and the result returned at approximately **09:45:40 UTC**. The default/current 300-second boundary was not re-waited in this run; the repository runbook retains prior v0.144.4 evidence separately.
- Redacted lifecycle JSON: The Codex CLI did not surface the MCP child’s stderr lifecycle lines in its host result, so no lifecycle JSON fields are fabricated here. Host-visible redacted observations are: `boundary=Codex MCP tools/call`, `deadlineOwner=host-configured MCP tool timeout`, `reason=tools/call timed out`, `elapsedMs≈3000`, `opaque IDs=not copied`. The follow-up `resume` returned the original round’s result, not a new question set.
- Cancellation/response-write observation; resume and exact synthetic-result-once result: The 3-second host tool deadline ended the original MCP call without browser answer loss. `resume` completed once after all 15 synthetic answers were submitted; the returned object contained exactly the 15 original question keys, with no duplicate or missing key. Normal 3600-second run also returned the complete synthetic result. Answer values are intentionally omitted from this evidence artifact.
- Conclusion limited to this installed version: Codex CLI **0.144.5** is verified for the tested local stdio MCP path: a normal 15-question round completes, an explicit host tool deadline leaves the browser round recoverable, and a fresh Codex process resumes and retrieves the exact submitted result. This does not claim behavior for other Codex versions, configurations, or untested default-deadline durations.
