# Phase 1: Timeout Diagnosis & Observability - Context

**Gathered:** 2026-07-16
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous no-question mode)

<domain>
## Phase Boundary

Instrument and reproduce the long-round failure so the project can identify the first lifecycle boundary that closes a round. This phase adds redacted correlation evidence and deterministic regression coverage; it does not yet redesign the host protocol or change timeout policy.

</domain>

<decisions>
## Implementation Decisions

### Evidence first
- Preserve the existing one-hour client timeout and disabled Node request timeout while diagnosing; do not mask the problem by increasing constants.
- Correlate host request id, bridge round id, host adapter, process id, and timestamps.
- Log lifecycle reasons without question text or answer values.

### the agent's Discretion
- Select the smallest shared module/API that can be used by both MCP and hook without changing their public contracts.
- Use deterministic fake-client and server tests for boundaries that cannot be exercised by a real Codex/Claude process in CI.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/log.cjs` is the non-throwing stderr logger.
- `createRequestId()` and bridge round ids already exist.
- `test/bridge-client.test.js` and `test/server.test.js` already provide live localhost test fixtures.

### Established Patterns
- Node built-in `node:test`, CommonJS tests, dynamic ESM imports, and temporary `XDG_CONFIG_HOME` isolation.
- Host errors currently fall back silently; diagnostics must remain stderr-only and redacted.

### Integration Points
- `lib/bridge-client.mjs` owns `/ask` timeout/abort mapping.
- `server/server.js` owns `/ask` response close and bridge cancellation.
- `mcp-server/askuserquestionspro-mcp.mjs` and `hooks/askuserquestionspro-bridge.mjs` own host-specific lifecycle entry/exit.

</code_context>

<specifics>
## Specific Ideas

Observed Codex behavior: a long round can close around question four after an uncertain, possibly five-minute interval. The user sees the browser disappear without a useful message. Claude behavior is unknown and must be measured separately.

</specifics>

<deferred>
## Deferred Ideas

Protocol redesign, MCP progress/keepalive, and resumable/chunked rounds are Phase 2 decisions after Phase 1 identifies the boundary.

</deferred>
