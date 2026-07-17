# Codex capability card

- Evidence date: 2026-07-17
- Version: authenticated live version unavailable (`Researching`)
- Evidence state: local automated/fake-host evidence only; live authenticated acceptance `Unavailable`
- Transport: MCP JSON-RPC over stdio to the loopback bridge
- Timeout/deadline owner: MCP adapter/bridge client boundary; live host deadline requires authenticated verification
- Cancellation/disconnect: stdin EOF detaches for explicit resume; MCP cancellation is terminal and idempotent
- Approval/trust: local single-user loopback model; MCP errors retain host fallback guidance
- Configuration: Codex MCP configuration scope only; installer must preserve Claude settings/hooks
- Installation/upgrade/uninstall: `node bin/cli.js install --target codex`, `doctor`, `reinstall`, and `uninstall` in an isolated home
- Scenarios covered locally: long-round progress, answer framing, detached resume, result replay, acknowledgement, stale selector and redaction assertions
- Live scenarios: idle, reconnect, restart, cancellation, exact recovery, result replay, delivery acknowledgement — `Unavailable` pending authenticated run
- Limitations: no Codex executable or authenticated session is installed in this environment; no live timeout claim is made
- Evidence: `test/adapter-contract.test.js`, `test/mcp-long-round.test.js`, `test/cli-adapters.test.js`
