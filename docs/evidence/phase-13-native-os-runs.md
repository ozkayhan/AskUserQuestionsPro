# Phase 13 native OS execution handoff

Native evidence is recorded per OS, architecture, Node version, exact command,
config-root descriptor, date, scenario, result, and limitation. Use isolated
HOME/XDG/product roots and redact diagnostics.

| OS | Architecture | Node | Result | Date | Limitation |
| --- | --- | --- | --- | --- | --- |
| macOS | arm64 | 26.0.0 | Partial/local automated | 2026-07-17 | Native external-host and full manual lane not run |
| Linux | unavailable | unavailable | Unavailable | 2026-07-17 | Run natively; WSL does not qualify |
| Windows | unavailable | unavailable | Unavailable | 2026-07-17 | Run natively; emulation does not qualify |

Maintainer handoff command: `npm ci && npm test && npm run lint && npm run
format:check`, followed by the complete scenario list in
[cross-platform evidence](phase-13-cross-platform.md). A Supported expansion
host additionally needs installed conformance, long-round, install/upgrade/
uninstall, trust, and config-scope evidence. Until then rows remain
`Researching`/`Unavailable`.
