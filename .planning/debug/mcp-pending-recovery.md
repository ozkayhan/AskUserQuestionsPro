---
status: resolved
trigger: "A Codex MCP ask call received a pending-round error without requestId or roundId; resume without an identifier failed, and a second one-question ask was rejected too."
created: 2026-08-03T00:00:00+03:00
updated: 2026-08-03T00:00:00+03:00
goal: find_and_fix
---

# Debug Session: MCP Pending Round Recovery Discovery

## Symptoms

- Expected: If an MCP ask collides with an existing pending round, the caller can identify/select that round and resume it, or receives a clear actionable fallback.
- Actual: The caller sees `A question set is already pending`, but no requestId, roundId, status, or discovery path; `resume` without an identifier fails and another ask remains blocked.
- Error messages: `askuserquestionspro failed: error: bridge returned 409. Use the host-native user-input tool if it is available in the current host.` and `resumeBridge requires an explicit requestId or roundId`.
- Timeline: Reported on Codex 0.144.4 / Conductor 0.77.4 with a 19-question ask, then reproduced by the reporter with a one-question ask.
- Reproduction: Keep one round pending, invoke MCP `ask` again, then invoke MCP `resume` without requestId/roundId.

## Current Focus

- hypothesis: The bridge correctly enforces single-flight, but the MCP adapter discards the structured `round_in_progress` response and exposes no safe recovery-discovery tool/path, making an existing recoverable round operationally unreachable from the reported host flow.
- test: Reproduce the MCP collision and inspect the HTTP 409 body, MCP tool result, recovery discovery endpoint/tool metadata, and whether the existing round remains answerable/resumable.
- expecting: The pending round remains intact; the failure is an information/adapter contract gap rather than question validation or a leaked second round.
- next_action: Add a focused failing regression for the collision/recovery response, then implement the smallest safe change that makes exact recovery discoverable without exposing question/answer/capability data.

## Session Manager

- 2026-08-03: Generic-agent workaround active; this runtime exposed no spawn-agent tool, so the scoped debugger workflow ran inline with the checkpoint as its source of truth.

## Evidence

- timestamp: 2026-08-03T00:00:00+03:00
  observation: `server/round-routes.cjs` intentionally returns HTTP 409 `{error, reason: 'round_in_progress'}` for a concurrent `/ask`, with no round metadata.
- timestamp: 2026-08-03T00:00:00+03:00
  observation: `mcp-server/askuserquestionspro-mcp.mjs` formats every non-400/non-timeout ask error as generic `error: bridge returned 409`, discarding `BridgeError.body.reason` and any recovery guidance.
- timestamp: 2026-08-03T00:00:00+03:00
  observation: The MCP surface exposes `ask` and `resume`; `resume` requires an explicit selector, while `/rounds` exists only as an HTTP discovery endpoint and is not exposed through MCP.
- timestamp: 2026-08-03T00:00:00+03:00
  observation: The reporter's second one-question call receiving the same 409 separates the symptom from payload size, language, question type, and option shape.
- timestamp: 2026-08-03T00:00:00+03:00
  observation: A focused MCP integration regression reproduced a live drafting round, a second `ask` collision, and the prior generic MCP error while the original round remained registered.
- timestamp: 2026-08-03T00:00:00+03:00
  observation: The bridge preserves the original round as intended; `drafting` is not resumable because its original ask call remains attached, while detached/reconnecting rounds require an exact selector.

## Eliminated

- hypothesis: The 19-question payload or option objects caused the failure.
  reason: A one-question binary call received the same pending-round conflict.
- hypothesis: Clerk, Supabase, Next.js, Vercel, or the reported application caused the failure.
  reason: The call path uses only the local MCP adapter and bridge; those application services are outside this process.

## Resolution

- root_cause: The loopback bridge correctly enforced single-flight and retained the pending round, but the Codex MCP adapter discarded `round_in_progress` and offered no MCP-safe discovery path to obtain an exact durable round ID.
- fix: Added the read-only `list_recoverable_rounds` MCP tool, redacted metadata client helper, and collision guidance that distinguishes active drafting rounds from exact-ID resumable detached/reconnecting rounds.
- verification: Regression was red before implementation; `npm test` passed (532 pass, 1 skip), `npm run lint` passed, `npm run format:check` passed, and the focused MCP collision/recovery test passed after formatting.
- files_changed: lib/bridge-client.mjs, mcp-server/askuserquestionspro-mcp.mjs, test/mcp-server.test.js, docs/api.md, README.md, .changeset/mcp-recovery-discovery.md

## Specialist Review

- specialist_hint: general
- result: No mapped `engineering:debug` specialist skill is installed in this runtime; no substitute review was dispatched.

## Blameless Postmortem

- why not caught: MCP coverage verified `ask` and `resume` separately but did not exercise a concurrent pending collision followed by MCP-native recovery discovery.
- guard: `test/mcp-server.test.js` now reproduces the collision, asserts actionable recovery guidance, and rejects prompt/capability leakage.
