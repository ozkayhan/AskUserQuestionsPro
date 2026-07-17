---
phase: 08-lifecycle-contract-observability
verified: 2026-07-17T10:03:50Z
status: gaps_found
score: 4/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 2/5
  gaps_closed:
    - "Detached rounds accept a correct-capability browser answer before resume, and the result remains recoverable."
    - "A closed or unwritable host response enters delivery-uncertain and a later resume returns the retained result."
    - "MCP resume tests wait for detached/reconnecting lifecycle states rather than fixed pre-answer sleeps."
    - "The acceptance evidence omits literal answer values and records Claude as unavailable without a support claim."
  gaps_remaining:
    - "Operational Bridge lifecycle events omit boundary and deadlineOwner metadata."
  regressions: []
gaps:
  - truth: "Support diagnostics identify the responsible lifecycle boundary and terminal reason with opaque identifiers, without exposing question or answer content."
    status: failed
    reason: "The redacted event schema accepts boundary and deadlineOwner, but the Bridge's real detach, resume, answer, cancellation, delivery-uncertain, and completion calls do not supply either field. The logger emits those fields only when supplied, so production Bridge diagnostics cannot identify the responsible lifecycle boundary or deadline owner."
    artifacts:
      - path: server/bridge.js
        issue: "Lines 121, 140, 154, 217, 228, 253, and 254 call lifecycle.event()/finish() with no metadata object."
      - path: lib/round-lifecycle.cjs
        issue: "Lines 68-69 conditionally serialize boundary/deadlineOwner only when callers supply allowlisted values."
      - path: test/round-lifecycle.test.js
        issue: "The test proves caller-supplied metadata is redacted, not that operational Bridge paths provide it."
    missing:
      - "Pass allowlisted boundary and deadlineOwner values through every operational Bridge lifecycle event and finish call."
      - "Add a Bridge/server integration assertion for the detach, resume, delivery-uncertain, cancellation, and completed paths."
---

# Phase 8: Lifecycle Contract & Observability Verification Report

**Phase Goal:** Users can keep a long-running round recoverable because its state, timeout owner, and terminal outcome are explicit rather than silently lost.
**Verified:** 2026-07-17T10:03:50Z
**Status:** gaps_found
**Re-verification:** Yes — after fix commit `80a64e4` (cherry-picked `ce2f919`)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | A user who loses a host attachment sees the round enter a distinct recoverable state instead of it appearing completed or disappearing. | ✓ VERIFIED | `lib/round-state.cjs:32-38` permits `detached`; `server/server.js:288-294` detaches request-id `/ask` connections; focused test `MCP stdin EOF aktif ask turunu detach eder ve yeni process resume edebilir` passes. |
| 2 | Support diagnostics identify the responsible lifecycle boundary and terminal reason with opaque identifiers, without exposing question or answer content. | ✗ FAILED | `lib/round-lifecycle.cjs:68-69` emits boundary/owner only if supplied, but every operational Bridge lifecycle call at `server/bridge.js:121,140,154,217,228,253-254` omits them. Redaction is sound, but required metadata is absent on those actual paths. |
| 3 | A stale, duplicate, delayed, or unauthorized operation cannot change another user's active or recovered round. | ✓ VERIFIED | `server/bridge.js:105-110` enforces id + opaque capability; focused Bridge/server tests cover wrong IDs/capabilities and retain the valid pending round. |
| 4 | An unavoidable host deadline detaches a round with recovery guidance, while ordinary idle time does not end it. | ✓ VERIFIED | State model transitions detached answers to `delivery-pending` (`lib/round-state.cjs:32-35`); focused tests pass for answer-before-resume and closed-response recovery. The redacted Codex 0.144.5 record documents a controlled 3-second host deadline with one resume; it makes no claim for untested default durations. |
| 5 | Maintainers can repeat lifecycle races and deadline paths deterministically and observe the expected state for each. | ✓ VERIFIED | `test/mcp-long-round.test.js:36-44` waits for `/current.lifecycle.state`; resume tests wait for `detached` then `reconnecting` at lines 244/262 and 423. Focused Phase 8 command passed 97 tests. |

**Score:** 4/5 truths verified (0 present, behavior-unverified)

## Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `lib/round-state.cjs` | Lifecycle vocabulary, legal transitions, redacted snapshot | ✓ VERIFIED | All nine required states exist; detached answers and delivery uncertainty have legal transitions. |
| `server/bridge.js` | State-backed coordinator, capability guard, lifecycle diagnostics | ⚠️ PARTIAL | Recovery/delivery wiring is substantive and tested; diagnostic metadata is missing on operational event calls. |
| `lib/round-lifecycle.cjs` | Redacted typed event schema | ⚠️ PARTIAL | Allowlist and content-redaction work, but caller wiring leaves boundary/owner absent on Bridge-generated events. |
| `server/server.js` / `web/live.js` | Capability-aware HTTP/SSE transport | ✓ VERIFIED | `/current`, SSE, `/answer`, and `/cancel` propagate lifecycle and capability; server tests pass. |
| `lib/bridge-client.mjs` / MCP adapter | Host deadline seam and detached recovery | ✓ VERIFIED | Both focused MCP resume scenarios pass after state-based synchronization. |
| `docs/evidence/phase-08-lifecycle-acceptance.md` | Redacted Tier-1 evidence or explicit unavailable record | ✓ VERIFIED | No literal answer value remains; Codex record is bounded to v0.144.5; Claude is explicitly skipped with no support claim. |

## Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `server/bridge.js` | `lib/round-state.cjs` | `createRecord`, `transition`, `snapshot` | ✓ WIRED | Imported at line 4 and used for submission, detach, resume, answer, delivery state, cancel, and expiry. |
| Bridge snapshot | `/current` and `/events` | `bridge.peek()` / `bridge.getSnapshot()` | ✓ WIRED | `server/server.js:208-217` and `229-232` serialize the active lifecycle snapshot. |
| Browser mutation | Bridge ownership guard | `capability` in `/answer` and `/cancel` | ✓ WIRED | Server rejects absent/wrong credentials with `ownership_conflict`; focused route tests pass. |
| Host loss / response close | recoverable Bridge result | detach → answer → `delivery-uncertain` → resume | ✓ WIRED | `sendJsonAndObserve()` detects response finish/close; focused closed-`/resume` test passes and later resume returns the result. |
| Bridge lifecycle events | boundary/owner diagnostics | `lifecycle.event()` / `finish()` | ✗ NOT WIRED | Actual Bridge calls omit metadata; logger has no default inference. |

## Data-Flow Trace

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `web/live.js` | round id, capability, lifecycle | `/current` then SSE | Bridge-generated snapshot | ✓ FLOWING |
| `server/server.js` | delivery result/state | `Bridge.provideAnswers()` then `sendJsonAndObserve()` | Real browser answer and HTTP finish/close outcome | ✓ FLOWING |
| `lib/round-lifecycle.cjs` | boundary / deadline owner | Operational Bridge calls | No — callers omit values | ✗ DISCONNECTED |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Focused lifecycle, recovery, transport, MCP, and docs checks | `node --test test/round-state.test.js test/round-lifecycle.test.js test/bridge.test.js test/server.test.js test/live.test.js test/bridge-client.test.js test/mcp-server.test.js test/mcp-long-round.test.js test/docs-integrity.test.js` | 97 passed, 0 failed (5.9s). Includes deterministic detached/reconnecting waits, answer-before-resume, and closed-response recovery. | ✓ PASS |
| Workspace suite | `npm test` | 406 passed, 1 failed (6.1s). The Phase 8-focused command above is green; this aggregate failure prevents representing the workspace suite as green. | ⚠️ WARNING |

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| LIFE-01 | 08-01, 08-02 | Explicit lifecycle states | ✓ SATISFIED | `STATES` contains the full required vocabulary and HTTP/SSE expose snapshots. |
| LIFE-02 | 08-02, 08-03, 08-05 | Redacted responsible-boundary diagnostics | ✗ BLOCKED | Schema is redacted, but operational diagnostics omit `boundary` and `deadlineOwner`. |
| LIFE-03 | 08-01, 08-02 | Isolation from stale/duplicate/delayed/unauthorized operations | ✓ SATISFIED | Capability-plus-id guard and focused regressions prove rejected mutations do not alter the active round. |
| LIFE-04 | 08-03, 08-05 | No avoidable idle expiry; host deadline preserves recovery | ✓ SATISFIED | Request-id host loss detaches; successful browser answers are retained through delivery uncertainty for resume. |
| LIFE-05 | 08-01, 08-02, 08-03 | Deterministic lifecycle/deadline coverage | ✓ SATISFIED | Named MCP recovery tests observe lifecycle states rather than relying on the former fixed pre-answer sleeps. |

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `server/bridge.js` | 121, 140, 154, 217, 228, 253-254 | Operational lifecycle calls omit required metadata | 🛑 Blocker | Diagnostics cannot identify the actual lifecycle boundary or timeout owner. |
| `docs/evidence/phase-08-lifecycle-acceptance.md` | 3, 7-12, 19-21 | Redaction and explicit-unavailable record | ℹ️ Info | Literal answer text is removed; Claude is skipped with no capability/support claim. |
| Phase implementation files | — | No unreferenced `TBD`, `FIXME`, or `XXX` markers found | ℹ️ Info | No debt-marker blocker. |

## Live Host Evidence and Skipped Checks

The Codex evidence is redacted: it records only lifecycle-safe metadata and an exact-once key-count assertion, not answer values. It limits its conclusion to the tested Codex CLI 0.144.5 configuration and explicitly does not claim the untested default deadline duration.

Claude Code is explicitly unavailable in this environment. The evidence file records it as **Unavailable**, says no Claude support or timeout conclusion is made, and treats it as a skipped host check—not a claimed verification result.

## Gaps Summary

The recovery fix closed the prior functional failures: detached answers are accepted, response-close delivery becomes `delivery-uncertain`, and deterministic MCP state waits now pass. Evidence redaction is also corrected. However, Phase 8's observability contract still fails: the event schema can carry `boundary` and `deadlineOwner`, while the actual Bridge event paths never provide them. This is a wiring failure, not a documentation-only gap; LIFE-02 remains blocked until every operational transition emits those allowlisted fields and an integration test proves it.

---

_Verified: 2026-07-17T10:03:50Z_
_Verifier: the agent (gsd-verifier)_
