# Antigravity CLI capability card

- Evidence date: 2026-08-10
- Version: official docs currently identify Antigravity CLI v1.1.11; authenticated runtime acceptance unavailable
- Evidence state: official MCP/plugin documentation plus local adapter regression tests; live authenticated acceptance `Unavailable`
- Transport: MCP JSON-RPC over stdio to the loopback bridge
- Timeout/deadline owner: Antigravity host/runtime; official MCP schema does not document a per-server tool timeout field
- Cancellation/disconnect: host behavior requires version-pinned authenticated acceptance; AskPro exposes explicit cancel and exact resume for recoverable rounds
- Approval/trust: Antigravity MCP tools use the host permission system; unconfigured tools default to Ask mode
- Configuration: global `~/.gemini/config/mcp_config.json`; plugin skill staged at `~/.gemini/antigravity-cli/plugins/askuserquestionspro`
- Installation/upgrade/uninstall: `node bin/cli.js install --target antigravity`, `doctor`, `reinstall`, and `uninstall` in an isolated home
- Scenarios covered locally: JSON merge/preservation, stale-path replacement, plugin deployment, doctor, uninstall, and shell target parsing
- Live scenarios: idle, reconnect, restart, cancellation, exact recovery, result replay, delivery acknowledgement — `Unavailable` pending authenticated run
- Limitations: no authenticated Antigravity session or version-pinned long-round acceptance is available in this workspace; do not infer host deadline guarantees from MCP registration alone
