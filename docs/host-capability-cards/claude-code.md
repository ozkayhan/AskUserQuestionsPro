# Claude Code capability card

- Evidence date: 2026-07-17
- Version: authenticated live version unavailable (`Researching`)
- Evidence state: local automated/fake-host evidence only; live authenticated acceptance `Unavailable`
- Transport: `PreToolUse` hook process to the loopback bridge
- Timeout/deadline owner: hook/bridge client boundary; live host deadline requires authenticated verification
- Cancellation/disconnect: hook failure preserves native picker fallback; host disconnect is distinct from explicit terminal cancellation
- Approval/trust: local single-user loopback model; hook emits `PreToolUse` allow/deny framing
- Configuration: Claude settings/hook scope only; installer must preserve Codex configuration
- Installation/upgrade/uninstall: `node bin/cli.js install --target claude`, `doctor`, `reinstall`, and `uninstall` in an isolated home
- Scenarios covered locally: malformed input, disabled/forced-MCP fallback, bridge failure, successful allow framing, lifecycle contract and redaction assertions
- Live scenarios: idle, reconnect, restart, cancellation, exact recovery, result replay, delivery acknowledgement — `Unavailable` pending authenticated run
- Limitations: no Claude executable or authenticated session is installed in this environment; no live timeout claim is made
- Evidence: `test/adapter-contract.test.js`, `test/hook-output.test.js`, `test/cli-adapters.test.js`
