---
phase: 09
plan: 03
subsystem: localhost-http-api
tags: [api, recovery, authorization]
status: complete
requires: [store-backed-bridge]
provides: [exact-recovery-api]
affects: [mcp, bridge-client]
tech-stack: [node-http, node-test]
decisions: [D-010]
metrics: { tasks: 2 }
---

# Phase 09 Plan 03: Recovery API Summary

Redacted durable-round discovery and exact capability-bound result/acknowledgement recovery API.

## Completed

- Added `GET /rounds`, exact durable metadata selection, explicit `/resume`, result replay, and acknowledgement endpoints.
- Added a compatibility correction: MCP and bridge-client resume now forward an exact request or durable round selector rather than relying on unsafe latest-round selection.

## Verification

`node --test test/server.test.js test/bridge.test.js test/round-store.test.js` and adapter recovery tests passed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Updated host adapters for explicit selector recovery**
- **Found during:** Task 2
- **Issue:** Existing adapter resume calls omitted selectors and would receive the new safe HTTP rejection.
- **Fix:** Forward request IDs or durable round IDs through bridge-client and MCP resume.
- **Files modified:** `lib/bridge-client.mjs`, `mcp-server/askuserquestionspro-mcp.mjs`, adapter tests.
- **Commit:** `113ebc7`

## Self-Check: PASSED

Recovery API commits `38b308c` and `113ebc7` exist.
