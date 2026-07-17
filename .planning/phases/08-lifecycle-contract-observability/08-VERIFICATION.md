---
phase: 08-lifecycle-contract-observability
verified: 2026-07-17T10:14:14Z
status: gaps_found
score: 4/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "Bridge answer, detach, resume, delivery-uncertain, completion, cancellation, and expiry paths now emit allowlisted boundary and deadlineOwner metadata."
  gaps_remaining:
    - "Several real non-Bridge lifecycle records still omit boundary and deadlineOwner metadata."
  regressions: []
gaps:
  - truth: "Support diagnostics identify the responsible lifecycle boundary and terminal reason with opaque identifiers, without exposing question or answer content."
    status: partial
    reason: "Commit 85d308d fixes the required Bridge transition paths, but the lifecycle contract and Plan 08-02 require every diagnostic event to identify its boundary and deadline owner. Actual focused-suite stderr proves round_started, ask_received, round_registered, and ask_response_closed omit both fields; adapter-client paths also emit/finish events without them."
    artifacts:
      - path: "server/server.js"
        issue: "Operational lifecycle.event()/finish() calls at lines 278, 284, 289, and 307 provide no boundary or deadlineOwner."
      - path: "lib/bridge-client.mjs"
        issue: "ask_received, normal answer/completion, and bridge-error diagnostics at lines 157, 178-179, and 193 lack ownership metadata."
      - path: "hooks/askuserquestionspro-bridge.mjs"
        issue: "Normal browser-opened/completed events at lines 109-111 lack ownership metadata."
      - path: "mcp-server/askuserquestionspro-mcp.mjs"
        issue: "The early-abort host_cancelled finish at line 231 lacks ownership metadata."
    missing:
      - "Supply allowlisted boundary and deadlineOwner values on every remaining operational lifecycle event and finish call, or centralize safe defaults in createLifecycle."
      - "Add an integration assertion that every emitted operational record has boundary and deadlineOwner while preserving the existing question/answer-redaction assertion."
---

# Phase 8: Lifecycle Contract & Observability Verification Report

**Phase Goal:** Users can keep a long-running round recoverable because its state, timeout owner, and terminal outcome are explicit rather than silently lost.
**Verified:** 2026-07-17T10:14:14Z
**Status:** gaps_found
**Re-verification:** Yes — after `80a64e4` and `85d308d`.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | A user who loses a host attachment sees the round enter a distinct recoverable state instead of it appearing completed or disappearing. | ✓ VERIFIED | `server/server.js:288-294` detaches request-id rounds on host close; `lib/round-state.cjs:32-38` permits detached recovery; focused MCP EOF and answer-before-resume tests pass. |
| 2 | Support diagnostics identify the responsible lifecycle boundary and terminal reason with opaque identifiers, without exposing question or answer content. | ✗ FAILED | Bridge transition events are fixed, but operational output from the 100-test focused run still shows `round_started`, `ask_received`, `round_registered`, and `ask_response_closed` without `boundary` or `deadlineOwner`. This violates LIFE-02 / the Plan 08-02 every-diagnostic-event contract. |
| 3 | A stale, duplicate, delayed, or unauthorized operation cannot change another user's active or recovered round. | ✓ VERIFIED | `server/bridge.js:118-123` guards id + opaque capability; `test/bridge.test.js` and `test/server.test.js` cover stale IDs, wrong/missing capability, and retained valid rounds. |
| 4 | An unavoidable host deadline detaches a round with recovery guidance, while ordinary idle time does not end it. | ✓ VERIFIED | Detached answer transitions to `delivery-pending`, response close becomes `delivery-uncertain`, and later `/resume` returns the retained result. The acceptance record scopes Codex to v0.144.5 and marks Claude unavailable without a support claim. |
| 5 | Maintainers can repeat lifecycle races and deadline paths deterministically and observe the expected state for each. | ✓ VERIFIED | The Phase 8 suite observes `detached`/`reconnecting` states instead of fixed pre-answer sleeps; command below passed 100/100. |

**Score:** 4/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `lib/round-state.cjs` | Explicit vocabulary, legal transitions, redacted snapshot | ✓ VERIFIED | Contains all nine LIFE-01 states and legal detached/recovery/delivery transitions. |
| `server/bridge.js` | Coordinator, ownership guard, attributed transition diagnostics | ✓ VERIFIED | `85d308d` supplies metadata for answer, detach, resume, uncertainty, completion, cancellation, and expiry; direct Bridge tests cover every path. |
| `lib/round-lifecycle.cjs` | Redacted typed event schema | ⚠️ PARTIAL | Schema safely allowlists metadata and excludes payloads, but it does not provide defaults; callers can and do emit incomplete records. |
| `server/server.js` / `web/live.js` | Capability-protected HTTP/SSE transport | ✓ VERIFIED | `/current`, `/events`, `/answer`, and `/cancel` propagate lifecycle/capability; focused route tests pass. |
| `lib/bridge-client.mjs` / adapters | Deadline-owner seams and resumable host loss | ⚠️ PARTIAL | Recovery behavior is tested, but several emitted lifecycle records lack boundary/owner attributes. |
| `docs/evidence/phase-08-lifecycle-acceptance.md` | Redacted real-host or explicit-unavailable evidence | ✓ VERIFIED | No literal question/answer data; Codex evidence is version-scoped; Claude is explicitly unavailable with no compatibility claim. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `server/bridge.js` | `lib/round-state.cjs` | `createRecord`, `transition`, `snapshot` | ✓ WIRED | Used for submit, detach, resume, answer, delivery, cancel, and expiry. |
| Bridge snapshot | `/current` and `/events` | `bridge.peek()` / `bridge.getSnapshot()` | ✓ WIRED | `server/server.js:208-217,229-232` serialize the active snapshot. |
| Browser mutation | Bridge ownership guard | id + capability in `/answer` and `/cancel` | ✓ WIRED | Wrong/missing credentials return `ownership_conflict` and leave the active round intact. |
| Host close | retained browser result | detach → answer → delivery-uncertain → resume | ✓ WIRED | Focused server tests exercise both answer-before-resume and closed-resume response recovery. |
| Operational lifecycle callers | attributed redacted diagnostics | `createLifecycle.event()` / `.finish()` | ✗ PARTIAL | Bridge transition calls are wired; several server/client/adapter event calls omit required details. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `web/live.js` | id, capability, lifecycle snapshot | `/current` and SSE | Bridge-generated state | ✓ FLOWING |
| `server/server.js` | delivery outcome | `sendJsonAndObserve()` after Bridge answer | Real HTTP finish/close signal | ✓ FLOWING |
| `lib/round-lifecycle.cjs` | boundary / deadline owner | operational callers | Incomplete for non-Bridge calls | ✗ DISCONNECTED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Phase 8 lifecycle, recovery, transport, MCP, and docs suite | `node --test test/round-state.test.js test/round-lifecycle.test.js test/bridge.test.js test/server.test.js test/live.test.js test/bridge-client.test.js test/mcp-server.test.js test/mcp-long-round.test.js test/docs-integrity.test.js` | 100 passed, 0 failed (5.76s) | ✓ PASS |
| Full workspace suite | `npm test` | 410 passed, 0 failed (3.48s) | ✓ PASS |
| Operational Bridge diagnostics | Focused test output + `test/bridge.test.js` and child-server stderr assertion | Answer/detach/resume/uncertainty/completion/cancellation/expiry are attributed and redacted; non-Bridge events are not all attributed. | ✗ FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| LIFE-01 | 08-01, 08-02, 08-04 | Explicit lifecycle states | ✓ SATISFIED | All nine states and transitions are in `lib/round-state.cjs`; snapshots reach HTTP/SSE. |
| LIFE-02 | 08-02, 08-03, 08-05 | Redacted responsible-boundary diagnostics | ✗ BLOCKED | Redaction and Bridge path attribution work, but emitted server/client/adapter records still lack required owner metadata. |
| LIFE-03 | 08-01, 08-02 | Cross-round isolation | ✓ SATISFIED | Capability-plus-id guards and focused regressions protect active/recovered rounds. |
| LIFE-04 | 08-03, 08-05 | No avoidable idle expiry; host deadline preserves recovery | ✓ SATISFIED | Request-id host loss detaches and retained results recover after uncertain delivery. |
| LIFE-05 | 08-01, 08-02, 08-03 | Deterministic lifecycle/deadline coverage | ✓ SATISFIED | State-observing MCP tests and injected lifecycle timing pass. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `server/server.js` | 278, 284, 289, 307 | Lifecycle emission omits boundary/owner | 🛑 Blocker | Lifecycle records cannot all be assigned to a responsible boundary. |
| `lib/bridge-client.mjs` | 157, 178-179, 193 | Lifecycle emission omits boundary/owner | 🛑 Blocker | Host-facing diagnostics are incomplete on normal/error paths. |
| `hooks/askuserquestionspro-bridge.mjs` | 109-111 | Lifecycle emission omits boundary/owner | 🛑 Blocker | Claude adapter evidence cannot consistently identify its boundary. |
| `mcp-server/askuserquestionspro-mcp.mjs` | 231 | Early host cancellation lacks ownership metadata | 🛑 Blocker | An actual terminal event lacks the required attribution. |
| Phase implementation files | — | No unreferenced `TBD`, `FIXME`, or `XXX` markers | ℹ️ Info | No debt-marker blocker. |

### Live Host Evidence

The current acceptance artifact is redacted: it contains no literal question text, answer values, credentials, or local paths. It scopes the Codex result to CLI 0.144.5 and a configured 3-second deadline run; it does not claim untested versions or default durations. Claude Code is explicitly unavailable and the artifact makes no Claude support or timeout claim.

## Gaps Summary

`85d308d` closes the prior Bridge-path wiring defect: the seven requested operational transitions now provide allowlisted boundary and deadline-owner metadata, and direct Bridge plus child-server tests prove no question or answer leakage. The phase still cannot pass because its own LIFE-02/Plan 08-02 contract applies to lifecycle diagnostics generally, while real emitted server, client, and adapter records continue to omit those fields. Add details at every call site (or safe centralized defaults) and a complete-emission integration assertion, then re-verify.

---

_Verified: 2026-07-17T10:14:14Z_
_Verifier: the agent (gsd-verifier)_
