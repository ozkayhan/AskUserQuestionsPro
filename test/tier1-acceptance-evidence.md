# Tier 1 acceptance evidence

Evidence date: 2026-07-17. Synthetic fixtures only; question and answer content is intentionally omitted.

| Host | Version | Transport | Scenario | Command | Result | Limitation |
|---|---|---|---|---|---|---|
| Claude Code | local fake host | PreToolUse subprocess | idle | `node --test test/fake-host-conformance.test.js test/hook-output.test.js` | Automated pass | Authenticated live host unavailable |
| Claude Code | local fake host | PreToolUse subprocess | reconnect | `node --test test/bridge-client.test.js` | Automated pass | Authenticated live host unavailable |
| Claude Code | local fake host | PreToolUse subprocess | restart | `node --test test/bridge.test.js` | Automated pass | Authenticated live host unavailable |
| Claude Code | local fake host | PreToolUse subprocess | cancel | `node --test test/hook-output.test.js test/bridge.test.js` | Automated pass | Authenticated live host unavailable |
| Claude Code | local fake host | PreToolUse subprocess | recovery | `node --test test/bridge.test.js` | Automated pass | Authenticated live host unavailable |
| Claude Code | local fake host | PreToolUse subprocess | result | `node --test test/bridge.test.js` | Automated pass | Authenticated live host unavailable |
| Claude Code | local fake host | PreToolUse subprocess | ack | `node --test test/server.test.js` | Automated pass | Authenticated live host unavailable |
| Claude Code | unavailable | PreToolUse hook | idle/reconnect/restart/cancel/recovery/result/ack | Authenticated procedure in `docs/hosts.md` | Unavailable | Requires installed, version-pinned Claude Code session |
| Codex | local fake/integration | MCP JSON-RPC stdio | idle | `node --test test/mcp-long-round.test.js test/fake-host-conformance.test.js` | Automated pass | Authenticated live host unavailable |
| Codex | local fake/integration | MCP JSON-RPC stdio | reconnect | `node --test test/mcp-long-round.test.js` | Automated pass | Authenticated live host unavailable |
| Codex | local fake/integration | MCP JSON-RPC stdio | restart | `node --test test/mcp-long-round.test.js test/bridge.test.js` | Automated pass | Authenticated live host unavailable |
| Codex | local fake/integration | MCP JSON-RPC stdio | cancel | `node --test test/mcp-long-round.test.js` | Automated pass | Authenticated live host unavailable |
| Codex | local fake/integration | MCP JSON-RPC stdio | recovery | `node --test test/mcp-long-round.test.js` | Automated pass | Authenticated live host unavailable |
| Codex | local fake/integration | MCP JSON-RPC stdio | result | `node --test test/mcp-long-round.test.js` | Automated pass | Authenticated live host unavailable |
| Codex | local fake/integration | MCP JSON-RPC stdio | ack | `node --test test/server.test.js test/mcp-long-round.test.js` | Automated pass | Authenticated live host unavailable |
| Codex | unavailable | MCP JSON-RPC stdio | idle/reconnect/restart/cancel/recovery/result/ack | Authenticated procedure in `docs/hosts.md` | Unavailable | Requires installed, version-pinned Codex session |

Live `Unavailable` rows are not passes and do not promote either host to fully live-accepted support.
