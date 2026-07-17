---
phase: 09-durable-round-store-recovery-api
verified: 2026-07-17T10:31:00Z
status: gaps_found
score: 3/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "Meaningful answer edits survive browser refresh, reconnect, closure, host detach, and bridge restart as revisions of the same round."
    status: failed
    reason: "Draft persistence is not wired and a fresh Bridge does not hydrate an unfinished durable round."
    artifacts:
      - path: "lib/round-record.cjs"
        issue: "saveDraft exists but has no production caller."
      - path: "server/bridge.js"
        issue: "Constructor always starts with _pending = null and has no store-hydration path."
    missing:
      - "Persist browser draft edits through RoundStore with revision checking."
      - "Hydrate a selected recoverable unfinished round into Bridge/browser ownership after restart."
  - truth: "Users can view and select an exact recoverable round without arbitrary latest-round behavior."
    status: failed
    reason: "The internal recovery API still accepts an absent selector and chooses the last completed result by Map iteration order."
    artifacts:
      - path: "server/bridge.js"
        issue: "waitForAnswers() calls _findCompleted(undefined), whose fallback returns the last Map value."
      - path: "test/bridge.test.js"
        issue: "The test 'resume round requestId olmadan en son detached cevabi bulur' codifies latest-round selection."
    missing:
      - "Require an exact durable round ID or unique request ID in every Bridge recovery path; remove the latest fallback and its test."
  - truth: "Existing pre-v1.1 requests continue into the durable recovery model without cross-round loss."
    status: failed
    reason: "Registration writes migration metadata, but an active legacy request cannot be resumed after a Bridge restart because unfinished records are never hydrated."
    artifacts:
      - path: "server/bridge.js"
        issue: "Only finalized records are retrievable from a fresh Bridge; selected unfinished records become stale_round."
    missing:
      - "Add restart integration coverage for a legacy registration and implement selected unfinished-round recovery."
  - truth: "The macOS evidence accurately records the durability checks that were run."
    status: failed
    reason: "The evidence claims injected write/sync/close/rename/lock/mkdir fault coverage, but the focused durable tests contain no injected filesystem implementation or fault-seam tests."
    artifacts:
      - path: "test/round-store.test.js"
        issue: "Contains only normal reload, corrupt JSON quarantine, and expiry cleanup tests."
      - path: "docs/evidence/phase-09-durable-recovery.md"
        issue: "Overstates automated coverage despite correctly limiting platform claims to macOS."
    missing:
      - "Add deterministic filesystem failure tests and correct/re-run the evidence record with only observed coverage."
---

# Phase 9: Durable Round Store & Recovery API Verification Report

**Phase Goal:** Users can reopen an exact saved round and safely retrieve its final answer after browser, host, or bridge interruption.  
**Verified:** 2026-07-17T10:31:00Z  
**Status:** gaps_found  
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Meaningful edits survive interruption/restart as revisions of the same round. | ✗ FAILED | `saveDraft` has no caller. A restart probe persisted and detached a round, then produced `{ "afterRestart": null, "resume": "stale_round" }` from a fresh `Bridge`. |
| 2 | A user can select an exact recoverable round without latest guessing. | ✗ FAILED | HTTP `/resume` validates selectors, but `Bridge.waitForAnswers()` still permits no selector and `_findCompleted()` returns the last result. The test suite codifies this behavior. |
| 3 | Partial/corrupt persisted records do not hide healthy records. | ✓ VERIFIED | `RoundStore._load()` validates each `.json` independently, quarantines invalid files, and continues; focused test confirms a valid sibling remains listable. Atomic writes sync, close, then rename. |
| 4 | Final answers are immutable and result/acknowledgement retries are safe. | ✓ VERIFIED | `Record.finalize()` returns the original matching result or `immutable_result`; `acknowledge()` preserves timestamp/revision. Focused server and bridge tests pass, including fresh-store result replay. |
| 5 | Pre-v1.1 requests enter the durable model safely. | ✗ FAILED | Registration writes `migration.legacyRegistration`, but the fresh-Bridge unfinished-round probe fails, so legacy active rounds cannot recover across the interruption the phase promises. |

**Score:** 3/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `lib/round-record.cjs` | Versioned records, revisions, immutable results/acks | ✓ VERIFIED | Substantive pure transition module; used by store and bridge. `saveDraft` is orphaned from production flows. |
| `lib/round-store.cjs` | Private atomic snapshots, scan, quarantine, TTL cleanup | ✓ VERIFIED | Used by server startup and Bridge; fresh probe observed `700` rounds/quarantine dirs and `600` snapshot. |
| `server/bridge.js` | Store-backed recovery and lifecycle transitions | ⚠️ HOLLOW | Store mutations are wired, but no constructor hydration reconstructs an unfinished recoverable round. |
| `server/server.js` | Exact recovery/result/ack HTTP contracts | ✓ VERIFIED | Routes delegate to Bridge and require selector/capability at the HTTP boundary. |
| `test/round-record.test.js`, `test/round-store.test.js` | Durable regression/fault coverage | ✗ STUB FOR REQUIRED FAULT COVERAGE | Tests cover normal record semantics, reload, corrupt JSON, and expiry only; no injected filesystem failure seam is exercised. |
| `docs/evidence/phase-09-durable-recovery.md` | Accurate bounded macOS evidence | ✗ STUB FOR CLAIMED COVERAGE | Correctly says macOS-only/no power-loss guarantee, but claims fault tests that do not exist. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `RoundStore` | `writeFileAtomic` | `_write()` | ✓ WIRED | Serializes complete record before `RoundStore` reports success. |
| `Bridge` | `RoundStore` | registration, transition, finalization, acknowledgement | ✓ WIRED | Durable mutations precede successful active-path transitions. |
| Fresh `RoundStore` | fresh `Bridge` | startup recovery | ✗ NOT_WIRED | Store loads records, but Bridge never consumes unfinished records into `_pending`. |
| HTTP routes | exact selectors / Bridge | `/rounds`, `/resume`, result, ack | ⚠️ PARTIAL | HTTP guards selectors, but Bridge retains an unqualified latest-result fallback. |
| Host adapters | explicit recovery selector | `resumeBridge()` and MCP `resume` | ✓ WIRED | Adapters forward request or durable round selectors to HTTP. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `RoundStore` | `_records` | individual `rounds/*.json` scan | Yes | ✓ FLOWING |
| `Bridge` | `_pending` | only `submitQuestions()` | No after restart | ✗ DISCONNECTED |
| `server/server.js` | recovery response | `Bridge.getDurable/getResult/waitForAnswers` | Final results only after restart | ⚠️ PARTIAL |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Focused durable/recovery suite | `node --test test/round-record.test.js test/round-store.test.js test/bridge.test.js test/server.test.js` | 77 passed, 0 failed | ✓ PASS |
| Workspace suite | `npm test` | 421 passed, 0 failed | ✓ PASS |
| Unfinished detached round after restart | isolated `Bridge`/`RoundStore` Node probe | `afterRestart: null`; `resume: stale_round` | ✗ FAIL |
| Restrictive macOS permissions | isolated `RoundStore` Node probe | rounds `700`, quarantine `700`, snapshot `600` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| DUR-01 | 09-01, 09-02 | Authoritative versioned local-disk record | ✓ SATISFIED | V1 snapshots, opaque IDs, and private files are created before registration is exposed. |
| DUR-02 | 09-01, 09-02 | Meaningful edits persist incrementally with revisions | ✗ BLOCKED | Revision primitive exists, but no browser/server path invokes `saveDraft`. |
| DUR-03 | 09-01, 09-02, 09-04 | Restart/crash/partial/corruption survival | ✗ BLOCKED | Per-record corruption isolation works, but fresh Bridge recovery of unfinished state fails and claimed fault coverage is absent. |
| DUR-04 | 09-03 | Exact selection; no arbitrary latest round | ✗ BLOCKED | HTTP is exact, but Bridge retains and tests unqualified latest selection. |
| DUR-05 | 09-02, 09-03, 09-04 | Immutable final answers; idempotent result/ack | ✓ SATISFIED | Matching final retries and repeated acknowledgements return stable persisted facts. |
| DUR-06 | 09-02, 09-03 | Safe pre-v1.1 migration | ✗ BLOCKED | Legacy marker/compatibility registration exists but does not survive active-round restart recovery. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `server/bridge.js` | 200–219, 310–319 | Selector-less latest-result fallback | 🛑 Blocker | Violates the exact-selection contract beneath the HTTP layer. |
| `docs/evidence/phase-09-durable-recovery.md` | 26–30 | Evidence claims unimplemented fault coverage | 🛑 Blocker | Makes the recorded durability evidence unreliable. |
| `test/round-store.test.js` | 15–42 | Missing required fault-injection tests | 🛑 Blocker | Atomic failure assertions are unproven despite being claimed. |

### Gaps Summary

The persistence primitives and finalized-result replay are real, and the local permission probe confirms the intended new-file modes. The phase goal is nevertheless not achieved: an unfinished detached round cannot be reopened after bridge restart, meaningful draft edits never reach the durable store, and the core Bridge still has a selector-less latest-result path. The macOS-only boundary is stated honestly, but the evidence overclaims test coverage. No later roadmap phase explicitly defers these durable-store/Bridge semantics, so these are actionable Phase 9 blockers.

---

_Verified: 2026-07-17T10:31:00Z_  
_Verifier: the agent (gsd-verifier)_
