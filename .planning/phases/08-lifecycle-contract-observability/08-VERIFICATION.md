---
phase: 08-lifecycle-contract-observability
verified: 2026-07-17T09:00:00Z
status: gaps_found
score: 2/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "Support diagnostics identify the responsible lifecycle boundary and terminal reason with opaque identifiers, without exposing question or answer content."
    status: failed
    reason: "The lifecycle schema supports boundary/deadlineOwner, but the Bridge's actual detach, resume, cancel, and completion event calls omit them; the live-evidence document also records the literal synthetic answer `Synthetic OK` despite its stated no-answer rule."
    artifacts:
      - path: "server/bridge.js"
        issue: "Lines 101-102, 120, 134, and 198-199 emit lifecycle events without boundary or deadlineOwner details."
      - path: "docs/evidence/phase-08-lifecycle-acceptance.md"
        issue: "Line 20 includes the literal answer value `Synthetic OK` after the document's prohibition on recording answers."
    missing:
      - "Pass allowlisted boundary and deadlineOwner values through every Bridge lifecycle event and terminal outcome."
      - "Remove literal answer values from the acceptance evidence while retaining a content-free exact-once assertion."
  - truth: "An unavoidable host deadline detaches a round with recovery guidance, while ordinary idle time does not end it."
    status: failed
    reason: "The automated MCP recovery scenario that underpins the detach/resume claim currently rejects the browser answer with HTTP 409. The historical Codex record is internally candid but cannot override a reproducible current regression."
    artifacts:
      - path: "test/mcp-long-round.test.js"
        issue: "The named MCP resume scenario fails at line 260: expected /answer 200, received 409. The stdin-EOF resume scenario similarly fails at line 417."
    missing:
      - "Repair and prove the MCP detach/resume-to-browser-answer path so the recovered round accepts its original capability and returns exactly once."
  - truth: "Maintainers can repeat lifecycle races and deadline paths deterministically and observe the expected state for each."
    status: failed
    reason: "Two committed lifecycle integration regressions fail reproducibly, and both rely on fixed 30 ms sleeps rather than waiting for the required detached/reconnecting state."
    artifacts:
      - path: "test/mcp-long-round.test.js"
        issue: "Named resume tests fail standalone and use fixed sleeps at lines 234/253 and 411 instead of state-based synchronization."
    missing:
      - "Make the MCP recovery tests wait for and assert the lifecycle state, then make the full deterministic suite pass."
---

# Phase 8: Lifecycle Contract & Observability Verification Report

**Phase Goal:** Users can keep a long-running round recoverable because its state, timeout owner, and terminal outcome are explicit rather than silently lost.
**Verified:** 2026-07-17T09:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | A lost host attachment enters a distinct recoverable state rather than appearing completed or absent. | ✓ VERIFIED | `lib/round-state.cjs` defines all nine states; `Bridge.detach()` transitions to `detached`; `server/server.js` projects the snapshot through `/current` and SSE. `test/server.test.js` passes its request-close → detached → resume scenario. |
| 2 | Diagnostics identify boundary, deadline owner, terminal reason, and opaque identifiers without content leakage. | ✗ FAILED | The schema allowlists those fields, but Bridge-originated detach/resume/cancel/complete calls omit boundary and owner. The acceptance record also contains literal synthetic answer text. |
| 3 | Stale, duplicate, delayed, or unauthorized operations cannot change another round. | ✓ VERIFIED | `server/bridge.js` requires matching id and capability for browser mutations; direct Bridge tests cover wrong id/capability, and `/answer`/`/cancel` return `ownership_conflict` on mismatch. |
| 4 | A host deadline detaches a round with recovery guidance while ordinary idle time does not end it. | ✗ FAILED | The documented Codex run claims this outcome, but the current committed MCP recovery regression returns HTTP 409 on the recovered browser answer. The live claim is not sufficient to contradict a reproducible code-level failure. |
| 5 | Lifecycle races and deadline paths are deterministically repeatable. | ✗ FAILED | Both MCP resume integration tests fail standalone; they also use fixed 30 ms waits instead of asserting detached/reconnecting state. |

**Score:** 2/5 truths verified (0 present, behavior-unverified)

## Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `lib/round-state.cjs` | Lifecycle vocabulary, transitions, redacted snapshot | ✓ VERIFIED | 59 substantive lines; states, ownership fields, and transition guard are used by `server/bridge.js`. |
| `server/bridge.js` | State-backed coordinator and capability guard | ⚠️ PARTIAL | Substantive and wired, but the integration recovery path fails and actual lifecycle emissions omit owner/boundary metadata. |
| `lib/round-lifecycle.cjs` | Redacted typed event schema | ⚠️ PARTIAL | Allowlist/redaction logic works in unit tests, but callers do not supply required metadata on several real paths. |
| `server/server.js` / `web/live.js` | Capability-aware HTTP/SSE transport | ✓ VERIFIED | `/current`, SSE, `/answer`, and `/cancel` transport lifecycle/capability; browser helpers preserve and send it. |
| `lib/bridge-client.mjs` / MCP adapter | Deadline seam and detach/resume behavior | ✗ FAILED | Implemented and invoked, but the focused end-to-end MCP resume tests fail with HTTP 409. |
| `docs/evidence/phase-08-lifecycle-acceptance.md` | Redacted Tier-1 evidence or explicit unavailability | ⚠️ PARTIAL | Claude absence is recorded honestly; Codex metadata matches the installed client. The document nevertheless records a literal answer value. |

## Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- |
| `server/bridge.js` | `lib/round-state.cjs` | `createRecord`, `transition`, `snapshot` | ✓ WIRED | Imported at line 4 and used for submit, detach, resume, answer, cancel, and expiry. |
| Bridge snapshot | `/current` and `/events` | `bridge.peek()` / `bridge.getSnapshot()` | ✓ WIRED | `server/server.js:77` serializes the separate lifecycle object; `web/live.js` retains it. |
| Browser mutation | Bridge ownership guard | `capability` in `/answer` and `/cancel` | ✓ WIRED | `web/app.js` passes the server-issued capability; `server/server.js:333` and `372` enforce it. |
| MCP host-loss signal | recoverable Bridge round | abort → request close → detach → resume | ✗ NOT WORKING | The intended link exists in code, but both committed MCP resume scenarios fail to accept the subsequent browser answer. |
| Lifecycle events | boundary/owner diagnostics | adapter/Bridge event calls | ✗ PARTIAL | The schema can serialize fields, but `server/bridge.js` does not provide them on its operational paths. |

## Data-Flow Trace

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `web/live.js` | `round` (`id`, `questions`, `capability`, `lifecycle`) | `/current` then SSE | Bridge-generated active snapshot | ✓ FLOWING |
| `web/app.js` | `capability` | `useLiveQuestions()` → `postAnswers()` | Server-issued opaque capability | ✓ FLOWING |
| `docs/evidence/phase-08-lifecycle-acceptance.md` | Codex observation fields | Manual host record | Version/auth facts verified now; historical run has no raw transcript | ⚠️ PARTIAL |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Phase 8 focused lifecycle, transport, adapter, and docs coverage | `node --test test/round-state.test.js test/round-lifecycle.test.js test/bridge.test.js test/server.test.js test/live.test.js test/bridge-client.test.js test/mcp-server.test.js test/mcp-long-round.test.js test/docs-integrity.test.js` | 91 passed, 1 failed: MCP resume `/answer` expected 200, got 409 | ✗ FAIL |
| Isolated MCP resume path | `node --test --test-name-pattern='MCP resume: kopan host turu browser cevabini yeni MCP processine verir' test/mcp-long-round.test.js` | Reproducibly failed: expected 200, got 409 | ✗ FAIL |
| Whole workspace test command | `npm test` | 400 passed, 2 failed: both MCP resume/EOF recovery tests | ✗ FAIL |
| Installed Codex evidence metadata | `codex --version && codex login status && codex doctor` | Codex CLI 0.144.5, ChatGPT logged in, macOS 26.4.1 confirmed | ✓ PASS |

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- |
| LIFE-01 | 08-01, 08-02 | Explicit lifecycle states | ✓ SATISFIED | `STATES` contains the complete required vocabulary; Bridge and HTTP/SSE snapshots use it. |
| LIFE-02 | 08-02, 08-03, 08-05 | Redacted responsible-boundary diagnostics | ✗ BLOCKED | Missing real-path boundary/owner fields and literal answer text in the evidence artifact. |
| LIFE-03 | 08-01, 08-02 | Isolation from stale/duplicate/delayed/unauthorized operations | ✓ SATISFIED | Capability-plus-id guard and direct regression coverage. |
| LIFE-04 | 08-03, 08-05 | No avoidable idle expiry; host deadline preserves recovery | ✗ BLOCKED | Current MCP recovery integration fails after detach. |
| LIFE-05 | 08-01, 08-02, 08-03 | Deterministic lifecycle/deadline coverage | ✗ BLOCKED | Two committed recovery regressions fail and rely on timing sleeps. |

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- |
| `test/mcp-long-round.test.js` | 234, 253, 411 | Fixed 30 ms timing waits in lifecycle tests | 🛑 Blocker | Race/deadline behavior is not deterministically synchronized; the tests fail. |
| `docs/evidence/phase-08-lifecycle-acceptance.md` | 20 | Literal answer value `Synthetic OK` | 🛑 Blocker | Contradicts the document's explicit privacy/redaction constraint. |
| Phase implementation files | — | No unreferenced `TBD`, `FIXME`, or `XXX` markers found | ℹ️ Info | No debt-marker blocker. |

## Live Host Evidence and Skipped Checks

The Codex acceptance record is honest about its limits in two important ways: it says the child-process stderr lifecycle JSON was not surfaced, and it does not claim untested default-duration behavior. Current runtime inspection independently confirms the recorded Codex version, operating system, and ChatGPT authentication.

Claude Code was explicitly unavailable in this environment. The evidence records that limitation, makes no Claude support or timeout conclusion, and is therefore treated as a valid skipped host check rather than a fabricated or failed Claude result.

Skipped checks:

- No Claude Code authenticated run: host unavailable by explicit environment constraint; no claim made.
- `npm run lint`: skipped because `eslint` is not installed (`exit 127`); no package installation performed.
- `npm run format:check`: skipped because `prettier` is not installed (`exit 127`); no package installation performed.
- The historical Codex 15-question run was not replayed during verification: rerunning it would require interactive browser submission and host-side state changes. Its metadata was inspected, but the current automated recovery failure prevents accepting it as phase proof.

## Gaps Summary

Phase 8 has the intended state model, transport wiring, and ownership guard, but it does not meet its lifecycle-observability and deterministic-recovery contract. The same MCP recovery path that the acceptance record relies on currently fails in isolated and full-suite tests. Fix that path and make the tests state-synchronized; propagate boundary/deadline-owner data through operational Bridge events; and redact the literal answer value from the evidence before re-verification.

---

_Verified: 2026-07-17T09:00:00Z_
_Verifier: the agent (gsd-verifier)_
