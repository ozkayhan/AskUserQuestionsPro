# Reliability-Milestone Feature Research

**Date:** 2026-07-16

## Table Stakes for v1 of This Milestone

### Long-running rounds

- A user can answer 15 or more questions over several minutes without the round disappearing.
- Idle time is not confused with failure; the UI remains usable while the host call is pending.
- The answer map survives navigation, review, reconnect-safe browser behavior, and partial completion.

### Lifecycle and recovery

- A host, browser, or server disconnect has a distinct reason and does not cross-cancel a newer round.
- Cancellation is explicit and idempotent; stale answers receive a safe conflict rather than resolving the wrong round.
- Host fallback is available when the custom bridge cannot be used, with a useful diagnostic path.

### Contract and compatibility

- Claude hook and Codex MCP paths preserve their existing input/output contracts.
- Question validation, typed answers, settings persistence, installers, and CLI doctor behavior remain consistent with the documented API.
- Node 18+, supported platforms, localhost-only binding, and zero runtime dependencies remain intact.

### Verification and operations

- Tests cover browser/server wire behavior rather than only pure helpers.
- A supportable diagnostic mode identifies the owner of a timeout without logging sensitive question content.
- Documentation has one maintained source for architecture, API contracts, operational troubleshooting, and test strategy.

## Differentiators Worth Preserving

- Reviewable full-screen UI with rich question types, keyboard navigation, themes, and accessibility semantics.
- One shared bridge client for Claude and MCP to prevent divergent fixes.
- Request/round ids that make stale-answer races detectable.
- Vendored browser assets and zero production dependencies for easy local installation.

## Anti-Features / Deferred Work

- Remote multi-user sessions, authentication, and cloud persistence: change the threat and state model and are not needed to fix this failure.
- New question types: increase contract surface while the lifecycle contract is still under repair.
- A full frontend build-system migration: not justified unless runtime Babel or vendored assets are proven to cause the reliability issue.
- Blindly increasing timeouts: does not solve host hard deadlines, hides root causes, and can strand processes.

## Dependencies and Complexity

| Capability | Complexity | Dependencies |
|------------|------------|--------------|
| Lifecycle instrumentation | Medium | Shared request/round identity and redacted logger |
| Host-specific reproduction harness | High | Codex/Claude integration access and controllable idle timing |
| MCP keepalive/progress strategy | High/uncertain | Client protocol behavior and host support |
| Resumable/chunked round fallback | High | New state/contract semantics, persistence or ticket lifecycle, skill guidance |
| Browser reconnect safety | Medium/high | SSE state machine and answer-map identity |
| Documentation taxonomy and migration | Medium | Inventory, cross-link audit, factual verification |
