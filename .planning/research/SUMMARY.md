# Project Research Summary

**Date:** 2026-07-16

## Key Findings

- The reported Codex failure is unlikely to be caused by the visible application timeout: both host adapters use a one-hour `askBridge` deadline and the Node HTTP server disables its default five-minute `requestTimeout`.
- The strongest hypothesis is that the host/MCP caller closes or cancels the long-lived `/ask` call. The server treats that `close` as authoritative and cancels the browser round, which explains why the page disappears without a useful UI error.
- A five-second `/current` poll is a registration race guard, not the long-round deadline; it should not be treated as the fix.
- The first implementation phase must add redacted lifecycle instrumentation and a deterministic Codex/Claude reproduction matrix. Only then can the project choose between MCP progress/keepalive and a resumable/chunked protocol for hard host deadlines.
- The existing bridge, browser, host, installer, and docs have clear seams that support phased refactoring. Round ownership, cancellation, SSE, and CommonJS/ESM boundaries are the highest-risk seams.
- The old audit and hardening plans contain valuable round-identity, settings-write, error visibility, and regression-test decisions, but several files overlap and should be consolidated rather than treated as independent current plans.

## Implications for Roadmap

1. Diagnose and instrument timeout ownership before changing timeout constants.
2. Implement and verify the host-specific lifecycle fix, beginning with Codex and checking Claude.
3. Harden shared bridge/server and browser lifecycle contracts against disconnects, stale rounds, and reconnects.
4. Complete the broad refactor audit across UI, tooling, installers, packaging, and tests.
5. Migrate documentation decisions/findings, then archive or remove stale duplicates and verify all links/claims.

## Sources

- `.planning/PROJECT.md`
- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/STACK.md`
- `.planning/codebase/CONCERNS.md`
- `.planning/codebase/INTEGRATIONS.md`
- `lib/bridge-client.mjs`
- `server/server.js`
- `server/bridge.js`
- `mcp-server/askuserquestionspro-mcp.mjs`
- `hooks/askuserquestionspro-bridge.mjs`
- `docs/architecture.md`
- `docs/api.md`
- `docs/testing.md`
- `docs/archive/audit-report-legacy.md`
- `docs/archive/hardening-plan-v2.md`
- `docs/archive/hardening-plan-dynamic.md`
