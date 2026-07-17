---
phase: 08-lifecycle-contract-observability
fixed_at: 2026-07-17T09:58:57Z
review_path: .planning/phases/08-lifecycle-contract-observability/08-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 08: Code Review Fix Report

**Fixed at:** 2026-07-17T09:58:57Z
**Source review:** `.planning/phases/08-lifecycle-contract-observability/08-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 5
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: Detached rounds reject the browser answer that recovery is meant to preserve

**Files modified:** `lib/round-state.cjs`, `server/bridge.js`, `test/bridge.test.js`, `test/server.test.js`
**Commit:** ce2f919
**Applied fix:** Detached rounds now accept correct-capability answers before any resume request; the result remains available for a later resume.

### CR-02: Lifecycle reports `delivered` before the host response is written

**Files modified:** `lib/round-lifecycle.cjs`, `lib/round-state.cjs`, `server/bridge.js`, `server/server.js`, `test/round-lifecycle.test.js`, `test/server.test.js`
**Commit:** ce2f919
**Applied fix:** Delivery is confirmed only after the HTTP response finishes. Closed or unwritable host responses enter `delivery-uncertain` and retain request-id results for recovery.

### WR-01: Published HTTP contract still describes the pre-capability API

**Files modified:** `docs/api.md`, `test/server.test.js`
**Commit:** ce2f919
**Applied fix:** The API reference now requires `capability` for `/answer` and `/cancel`, and documents `ownership_conflict`; route coverage asserts missing and wrong credentials are rejected.

### WR-02: Browser transport tests silently validate requests that production now rejects

**Files modified:** `test/live.test.js`, `test/server.test.js`
**Commit:** ce2f919
**Applied fix:** Browser transport tests serialize capabilities and assert the ownership-conflict response contract.

### WR-03: MCP recovery tests use timing sleeps instead of the required deterministic state boundary

**Files modified:** `test/mcp-long-round.test.js`
**Commit:** ce2f919
**Applied fix:** MCP recovery tests wait for lifecycle `detached` and `reconnecting` states instead of fixed sleeps.

---

_Fixed: 2026-07-17T09:58:57Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
