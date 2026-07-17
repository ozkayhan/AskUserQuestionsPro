---
phase: 08-lifecycle-contract-observability
verified: 2026-07-17T10:23:39Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "Support diagnostics identify the responsible lifecycle boundary and terminal reason with opaque identifiers, without exposing question or answer content."
  gaps_remaining: []
  regressions: []
---

# Phase 8: Lifecycle Contract & Observability Verification Report

**Phase Goal:** Users can keep a long-running round recoverable because its state, timeout owner, and terminal outcome are explicit rather than silently lost.
**Verified:** 2026-07-17T10:23:39Z
**Status:** passed
**Re-verification:** Yes — after `84b460a`.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | A user who loses a host attachment sees the round enter a distinct recoverable state instead of it appearing completed or disappearing. | ✓ VERIFIED | `server/server.js:289-303` detaches request-id rounds on host-close and retains a delivery-uncertain result; `test/server.test.js` and `test/mcp-long-round.test.js` exercise answer-before-resume, a closed resume response, and stdin EOF recovery. |
| 2 | Support diagnostics identify the responsible lifecycle boundary and terminal reason with opaque identifiers, without exposing question or answer content. | ✓ VERIFIED | `lib/round-lifecycle.cjs:54-97` now assigns allowlisted defaults to every record and only serializes its fixed schema. The focused suite's live server output shows every record has `boundary`/`deadlineOwner`; its real-server test proves no secret question or answer leaks. |
| 3 | A stale, duplicate, delayed, or unauthorized operation cannot change another user's active or recovered round. | ✓ VERIFIED | `server/bridge.js:118-139,261-280` and capability-required HTTP mutation tests reject wrong/missing credentials while preserving the pending round; direct race and route tests pass. |
| 4 | An unavoidable host deadline detaches a round with recovery guidance, while ordinary idle time does not end it. | ✓ VERIFIED | The MCP EOF test detaches and later resumes the original round; `docs/evidence/phase-08-lifecycle-acceptance.md:16-21` records an authenticated Codex 0.144.5 3-second host deadline followed by one successful resume, while the server leaves `requestTimeout = 0`. |
| 5 | Maintainers can repeat lifecycle races and deadline paths deterministically and observe the expected state for each. | ✓ VERIFIED | The 102-test Phase 8 command passes state-observing recovery and injected-timer tests; no Phase 8 race test uses a fixed pre-answer sleep. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `lib/round-state.cjs` | Explicit lifecycle vocabulary, legal transitions, redacted snapshot | ✓ VERIFIED | Nine LIFE-01 states, including detached/reconnecting and delivery-uncertain, plus legal transitions and payload-free snapshots. |
| `server/bridge.js` | State-machine coordinator and ownership guard | ✓ VERIFIED | Uses the shared transitions for answer, detach, resume, delivery, cancellation, and expiry; emits explicit transition metadata. |
| `lib/round-lifecycle.cjs` | Redacted typed lifecycle event schema | ✓ VERIFIED | The post-`84b460a` default boundary and `deadlineOwner: none` close the prior incomplete-caller gap; unknown adapter falls back safely to `bridge`. |
| `server/server.js` / `web/live.js` | Capability-protected HTTP/SSE lifecycle transport | ✓ VERIFIED | `/current` and SSE project a separate lifecycle snapshot; browser mutations carry `id` and capability and server tests reject invalid ownership. |
| `lib/bridge-client.mjs` / hook / MCP | Deadline-owner seam and host-loss recovery | ✓ VERIFIED | Client paths use the supplied lifecycle recorder, hook creates `adapter: hook`, MCP creates `adapter: mcp`; all unannotated events receive centralized safe defaults and terminal paths retain explicit overrides. |
| `docs/evidence/phase-08-lifecycle-acceptance.md` | Redacted authenticated-host or explicit-unavailable evidence | ✓ VERIFIED | Claude is conspicuously unavailable with no support claim; Codex evidence is authentication-, version-, configuration-, and deadline-scoped. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- |
| `server/bridge.js` | `lib/round-state.cjs` | `createRecord`, `transition`, `snapshot` | ✓ WIRED | The Bridge delegates lifecycle legality and public projection to the shared contract. |
| Bridge snapshot | `/current` and `/events` | `bridge.peek()` / `bridge.getSnapshot()` | ✓ WIRED | `server/server.js:208-246` serializes the authoritative lifecycle state in both HTTP and SSE paths. |
| Browser mutation | Bridge ownership guard | `id` + capability in `/answer` and `/cancel` | ✓ WIRED | Browser transport serializes capability and server tests prove missing/wrong credentials cannot mutate the round. |
| Host close | retained browser result | detach → answer → delivery-uncertain → resume | ✓ WIRED | Direct Bridge, real-server, and spawned-MCP tests cover this complete recovery chain. |
| Server, Bridge, client, hook, MCP | redacted lifecycle output | shared `createLifecycle()` recorder | ✓ WIRED | There are no bypass lifecycle log emitters. Factory defaults cover `http`, `hook`, `mcp`, `stdio`, and safe unknown-adapter fallback; Bridge overrides ownership on state-changing paths. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `web/live.js` / `server/server.js` | lifecycle snapshot | Bridge `getSnapshot()` through `/current` and SSE | State-machine record | ✓ FLOWING |
| `lib/round-lifecycle.cjs` | diagnostic metadata | Operational callers through `createLifecycle()` | Fixed allowlisted payload with opaque IDs and elapsed time | ✓ FLOWING |
| `docs/evidence/phase-08-lifecycle-acceptance.md` | live host outcome | Authenticated Codex execution; explicit Claude unavailability | Version-scoped observed result, not inferred compatibility | ✓ FLOWING |

### Operational Lifecycle Output Audit

| Source | Construction / output path | Attribution result |
| --- | --- | --- |
| Central factory | `lib/round-lifecycle.cjs:54-97` | ✓ Every record has an allowlisted boundary and deadline owner; arbitrary payload fields are discarded. |
| HTTP server | `server/server.js:274-307` | ✓ HTTP default is applied to start/registration/close/error records; Bridge contributes explicit browser/bridge outcomes. |
| Bridge | `server/bridge.js:128-296` | ✓ Answer, detach, resume, uncertainty, completion, cancellation, and expiry provide explicit boundary/owner values. |
| Bridge client | `lib/bridge-client.mjs:147-194` | ✓ Normal and bridge-error records inherit adapter defaults; caller abort and application timeout override ownership. |
| Claude hook | `hooks/askuserquestionspro-bridge.mjs:96-119` | ✓ Hook-created records inherit `hook`/`none`; error outcomes provide explicit owner values. |
| Codex MCP | `mcp-server/askuserquestionspro-mcp.mjs:228-301` | ✓ Early cancellation inherits `mcp`/`none`; browser-open, stdio EOF, host cancellation, and application timeout are explicitly attributed. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Phase 8 lifecycle, recovery, transport, adapter, and docs coverage | `node --test test/round-state.test.js test/round-lifecycle.test.js test/bridge.test.js test/server.test.js test/live.test.js test/bridge-client.test.js test/mcp-server.test.js test/mcp-long-round.test.js test/docs-integrity.test.js` | 102 passed, 0 failed (3.46s) | ✓ PASS |
| Full workspace regression suite | `npm test` | 412 passed, 0 failed (5.72s) | ✓ PASS |
| All emitted real-server lifecycle records are attributed and redacted | Included in the focused suite: `real server lifecycle diagnostics attribute Bridge events without question or answer payloads` | Child-server stderr records all had `boundary` and `deadlineOwner`; secret question/answer fixtures were absent. | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| LIFE-01 | 08-01, 08-02, 08-04 | Explicit lifecycle states | ✓ SATISFIED | Shared state contract contains all nine required states and is visible through HTTP/SSE snapshots. |
| LIFE-02 | 08-02, 08-03, 08-05 | Redacted responsible-boundary diagnostics | ✓ SATISFIED | Central defaults cover every operational caller; allowlist/redaction tests and real-server stderr assertion pass. |
| LIFE-03 | 08-01, 08-02 | Cross-round isolation | ✓ SATISFIED | Id-plus-capability guards and direct/HTTP stale-operation regressions pass. |
| LIFE-04 | 08-03, 08-05 | No avoidable idle expiry; host deadline preserves recovery | ✓ SATISFIED | Request-id loss detaches, results remain recoverable, and the Codex evidence records the tested host deadline. |
| LIFE-05 | 08-01, 08-02, 08-03 | Deterministic lifecycle/deadline coverage | ✓ SATISFIED | Focused tests use explicit state observation and injected timer seams for the lifecycle paths. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| Phase 8 implementation and test files | — | No unreferenced `TBD`, `FIXME`, or `XXX` markers; no lifecycle logging bypass | ℹ️ Info | No completion-audit blocker found. |

### Live Host Evidence

The accepted evidence is appropriately asymmetric. Claude Code is explicitly unavailable and makes no compatibility or timeout claim. Codex CLI 0.144.5 is backed by an authenticated, locally scoped MCP run: normal completion, a configured three-second host tool deadline, retained browser round, one fresh-process resume, and exactly the original 15 result keys. It does not extrapolate to other versions, configurations, or default deadline durations. The evidence and the live-server redaction test contain no literal question text, answer values, credentials, or local paths.

### Disconfirmation Pass

- **Former partial requirement:** the previous verifier found non-Bridge records missing attribution. `84b460a` changes the common serializer rather than relying on missed call sites, and the central-default plus real-server tests now prove the closure.
- **Misleading-test check:** the focused test was not accepted merely because it passed; the child-server stderr assertion inspects the actual serialized records and rejects question/answer leakage.
- **Error-path coverage:** host cancellation, stdin EOF, application timeout, response-close delivery uncertainty, and stale/missing/wrong capability paths are all exercised by named Phase 8 tests.

## Gaps Summary

No blocking gaps remain. The former LIFE-02 blocker is closed by safe central defaults in `createLifecycle()`, verified against all operational adapter values and a real HTTP server lifecycle stream. No later-phase work is needed to defer an unmet Phase 8 truth.

---

_Verified: 2026-07-17T10:23:39Z_
_Verifier: the agent (gsd-verifier)_
