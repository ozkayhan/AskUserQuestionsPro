# Tier 1 acceptance evidence

Evidence date: 2026-07-17. Synthetic fixtures only; question and answer content is intentionally omitted.

| Host | Version | Transport | Scenario | Command | Result | Limitation |
|---|---|---|---|---|---|---|
| Claude Code | local fake host | PreToolUse subprocess | idle/fallback and framing | `node --test test/fake-host-conformance.test.js test/hook-output.test.js` | Automated pass | Authenticated live host unavailable |
| Claude Code | unavailable | PreToolUse hook | reconnect/restart/cancel/recovery/result/ack | Authenticated procedure in `docs/hosts.md` | Unavailable | Requires installed, version-pinned Claude Code session |
| Codex | local fake/integration | MCP JSON-RPC stdio | idle long round and progress | `node --test test/mcp-long-round.test.js` | Automated pass | Authenticated live host unavailable |
| Codex | local fake/integration | MCP JSON-RPC stdio | EOF detach, exact resume, result replay | `node --test test/mcp-long-round.test.js` | Automated pass | Synthetic bridge, not live Codex |
| Codex | unavailable | MCP JSON-RPC stdio | restart/cancel/recovery/delivery acknowledgement | Authenticated procedure in `docs/hosts.md` | Unavailable | Requires installed, version-pinned Codex session |

Live `Unavailable` rows are not passes and do not promote either host to fully live-accepted support.
