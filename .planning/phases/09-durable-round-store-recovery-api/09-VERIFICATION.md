---
phase: 09-durable-round-store-recovery-api
verified: 2026-07-17T11:23:37Z
status: gaps_found
score: 13/15 must-haves verified
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 13/15
  gaps_closed: []
  gaps_remaining:
    - "Meaningful answer edits can still be lost when the immediate draft request fails or is aborted during reload/closure."
  regressions: []
gaps:
  - truth: "Meaningful answer edits survive browser refresh, reconnect, closure, host detach, and bridge restart as revisions of the same round."
    status: failed
    reason: "DraftWriter starts a request immediately, but catches a failed or aborted save, clears its only queued draft, and performs no retry or durable unload handoff. A reload/closure can abort fetch after the edit and before the server commits it."
    artifacts:
      - path: "web/draft-writer.js"
        issue: "The catch path at lines 23-26 discards the only unsaved draft; writer state has no retry, failure signal, or persisted pending queue."
      - path: "web/live.js"
        issue: "postDraft uses ordinary fetch without an unload-delivery guarantee; page reload/closure can therefore reject the request that DraftWriter suppresses."
      - path: "test/draft-writer.test.js"
        issue: "The test proves save() is invoked synchronously, not that an aborted/rejected save remains recoverable after unmount/reload."
    missing:
      - "Retain and retry the latest failed draft, including a tested reload/closure-safe delivery strategy or explicit recovery handoff."
      - "Add an integration regression that aborts the first draft transport, unmounts/reloads, and proves the last edit is hydrated from the server record."
behavior_unverified_items:
  - truth: "A crash or partial write leaves the prior named snapshot usable while the affected record has a safe recovery outcome."
    test: "Inject write, fsync, close, rename, lock, and directory-creation failures into RoundStore/atomic-write, then reload the store."
    expected: "The prior named valid snapshot remains available; temporary artifacts are ignored or cleaned; the failed record returns a typed persistence/recovery error without hiding healthy records."
    why_human: "The implementation uses temp → fsync → close → rename and normal corruption handling passes, but no current RoundStore test injects the required filesystem failures. macOS evidence honestly excludes power-loss and those individual fault paths."
---

# Phase 9: Durable Round Store & Recovery API Verification Report

**Phase Goal:** Users can reopen an exact saved round and safely retrieve its final answer after browser, host, or bridge interruption.
**Verified:** 2026-07-17T11:23:37Z
**Status:** gaps_found
**Re-verification:** Yes — after `b41557a`

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Meaningful edits survive refresh, reconnect, closure, host detach, and restart as revisions of the same round. | ✗ FAILED | Immediate invocation fixes the old debounce cancellation, but rejected/aborted `postDraft()` is swallowed and discarded. A direct aborted-save reproduction left `durable: null`, `attempts: 1`, `retried: false`. |
| 2 | A user can choose one recoverable round; the product does not guess a latest round. | ✓ VERIFIED | `waitForAnswers()` rejects absent selectors; `/resume`, `resumeBridge()`, and MCP resume pass an exact request/round selector. Focused selector tests pass. |
| 3 | Crash, partial-write, or corrupt-record handling preserves healthy records and safely handles the bad one. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Corrupt-sibling quarantine succeeds and the atomic primitive is substantive, but write/sync/close/rename/mkdir fault injection required by Plan 09-01 is absent. |
| 4 | A submitted answer is immutable; result retrieval and acknowledgement retries are safe. | ✓ VERIFIED | Record transitions reject changed final retries, replay matching results, and preserve the first acknowledgement timestamp/revision across restart. |
| 5 | Existing pre-v1.1 requests enter the durable model without cross-round loss. | ✓ VERIFIED | Registration creates a legacy-marked durable record while preserving the successful `{ answers }` envelope and numeric active-round guard. |
| 6 | Registration produces a versioned private snapshot before visibility. | ✓ VERIFIED | `Bridge.submitQuestions()` calls `RoundStore.create()` before exposing `peek`; record/store regressions pass. |
| 7 | Each accepted persisted mutation advances revision once; idempotent/conflicting retries cannot overwrite it. | ✓ VERIFIED | `Record.saveDraft`, `finalize`, and `acknowledge` provide revision guards and replay semantics; focused tests pass. |
| 8 | Initial durable retention follows the resolved detached-round TTL. | ✓ VERIFIED | Bridge passes resolved TTL into `RoundStore.create`; expiry is persisted and targeted cleanup removed only the expired snapshot. |
| 9 | Lifecycle transitions persist before success is reported. | ✓ VERIFIED | Bridge delegates draft, detach/resume, result, acknowledgement, cancellation, and expiry through store mutation before reporting success. |
| 10 | Legacy successful envelopes remain compatible while unsafe recovery is typed. | ✓ VERIFIED | `/ask`, `/answer`, `/cancel`, and successful `/resume` retain compatible responses; missing selector is `invalid_selector`. |
| 11 | Invalid, expired, missing, ambiguous, or unauthorized recovery requests are redacted typed errors. | ✓ VERIFIED | `recoveryError()` maps selection and ownership failures; server tests cover redacted discovery and capability checks. |
| 12 | Maintained docs describe exact selection, results, acknowledgement, retention, quarantine, and Node authority. | ✓ VERIFIED | `docs/api.md` and D-010 match the implemented routes and declare browser storage non-authoritative. |
| 13 | macOS evidence is bounded and does not claim Linux/Windows/power-loss validation. | ✓ VERIFIED | Evidence and D-010 expressly limit claims to macOS and exclude Linux, Windows, and universal power-loss guarantees. |
| 14 | Support docs keep discovery and recovery outcomes redacted. | ✓ VERIFIED | Discovery docs exclude questions, answers, capabilities, diagnostics, and paths. |
| 15 | Existing store directories and snapshots use restrictive permissions. | ✓ VERIFIED | Independent macOS probe observed `rounds=700`, `quarantine=700`, `snapshot=600`; constructor also chmods existing directories. |

**Score:** 13/15 truths verified (1 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `lib/round-record.cjs` | Versioned records, revisions, immutable result/ack facts | ✓ VERIFIED | Substantive validation/transition chokepoint used by store and bridge. |
| `lib/round-store.cjs` | Private snapshots, scan, quarantine, TTL cleanup | ✓ VERIFIED | Uses atomic writer, validates records independently, quarantines bad siblings, tightens directories, and deletes expired owned snapshots. |
| `lib/atomic-write.cjs` | Private temp/sync/close/rename plus safe locking | ✓ VERIFIED | A lock pathname causes fail-closed `concurrent write lock`; no stale-lock stealing remains. |
| `server/bridge.js` | Store-backed lifecycle, restart hydration, exact recovery | ✓ VERIFIED | Hydrates drafting/detached/reconnecting records and the repeated-restart regression passes. |
| `server/server.js` | Exact discovery/recovery/draft/result/ack HTTP contracts | ✓ VERIFIED | Validates selectors/capabilities and delegates to Bridge. |
| `web/app.js`, `web/live.js`, `web/draft-writer.js` | Durable browser drafts | ✗ HOLLOW | The request starts immediately but failure/unload handling loses the sole pending material edit. |
| `test/round-record.test.js`, `test/round-store.test.js`, `test/bridge.test.js`, `test/server.test.js`, `test/settings.test.js`, `test/draft-writer.test.js` | Durable regression coverage | ⚠️ PARTIAL | 143 focused tests pass, including restart, selector, result/ack, quarantine, retention, modes, and lock; no injected filesystem-failure or aborted-draft recovery regression exists. |
| Durable API/decision/evidence docs | Honest recovery contract and platform scope | ✓ VERIFIED | Documentation matches the code and confines live filesystem claims to macOS. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `RoundStore` | `writeFileAtomic` | `_write()` | ✓ WIRED | Record enters `_records` only after atomic writer success. |
| `Bridge` | `RoundStore` | registration, draft, transitions, result, acknowledgement | ✓ WIRED | Authoritative mutations use store decisions before bridge success. |
| Fresh store | fresh `Bridge` | constructor hydration / `_recover()` | ✓ WIRED | Detached and reconnecting restart paths are covered by focused bridge tests. |
| Browser Flow | `/draft` | `DraftWriter` → `postDraft()` | ✗ NOT DURABLE | Call is wired but failed transport is discarded; the link cannot guarantee browser interruption recovery. |
| Host adapters | explicit selector | `resumeBridge()` / MCP `resume` | ✓ WIRED | No selector-less latest fallback remains. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `RoundStore` | `_records` | Validated `rounds/*.json` scan | Yes | ✓ FLOWING |
| `Bridge` | `_pending` | Newly created or durable-hydrated record | Yes | ✓ FLOWING |
| Browser `Flow` | `answers` / draft revision | React state → immediate `/draft` | Only on successful transport; abort/rejection drops the latest edit | ✗ HOLLOW |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Focused Phase 9 suite | `node --test test/round-record.test.js test/round-store.test.js test/bridge.test.js test/server.test.js test/settings.test.js test/bridge-client.test.js test/mcp-long-round.test.js test/draft-writer.test.js` | 143 passed, 0 failed | ✓ PASS |
| Full workspace suite | `npm test` | 430 passed, 0 failed | ✓ PASS |
| Reconnecting round restart/recovery | focused bridge regression | Detach → resume/reconnecting → restart → resume → answer passes | ✓ PASS |
| Immediate edit then aborted reload/unmount transport | isolated `DraftWriter` rejection reproduction | `attempts: 1`, `durable: null`, `retried: false` | ✗ FAIL |
| Exact selector recovery | focused bridge/server tests | Selector-less recovery rejects; exact round/request selection succeeds | ✓ PASS |
| Quarantine, retention, permissions | isolated `RoundStore` probes | Healthy sibling listed / bad file quarantined; expired file removed only; modes `700/700/600` | ✓ PASS (macOS) |
| Immutable result and idempotent acknowledgement | focused bridge/server tests | Matching result replay and repeated ack preserve stored facts | ✓ PASS |
| Fail-closed lock | focused settings regression | Existing stale lock causes typed concurrent-lock failure; contender never unlinks another owner | ✓ PASS |
| Lint / formatting | `npm run lint`; `npm run format:check` | `eslint` and `prettier` executables are absent in this checkout (both exit 127) | ? ENVIRONMENT LIMITATION |

### Probe Execution

No Phase 9 `scripts/**/tests/probe-*.sh` probe is declared or present.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| DUR-01 | 09-01, 09-02 | Server maintains authoritative versioned local round records. | ✓ SATISFIED | Versioned private store is created before exposure and reloads into Bridge. |
| DUR-02 | 09-01, 09-02 | Meaningful edits persist incrementally with revisions. | ✗ BLOCKED | Aborted/rejected browser draft transport discards the last edit without retry/recovery. |
| DUR-03 | 09-01, 09-02, 09-04 | Records survive restart, crash/partial writes, and corruption. | ? NEEDS HUMAN / TESTS | Restart and corruption/quarantine pass; individual filesystem failure paths are untested. |
| DUR-04 | 09-03 | Exact recoverable-round selection; no arbitrary latest behavior. | ✓ SATISFIED | Explicit selector requirement and redacted discovery/recovery tests pass. |
| DUR-05 | 09-02, 09-03, 09-04 | Immutable final answer and idempotent result/ack. | ✓ SATISFIED | Persisted replay semantics pass before/after restart. |
| DUR-06 | 09-02, 09-03 | Safe legacy migration. | ✓ SATISFIED | Legacy registration remains compatible and is durably mapped at registration. |

No Phase 9 requirement is orphaned from the plans. No later roadmap phase specifically defers DUR-02 or the missing DUR-03 fault coverage; Phase 11 concerns recovery UX, while Phase 13 is cross-platform validation rather than this phase's implementation/test contract.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `web/draft-writer.js` | 23-26 | Rejected draft save is silently discarded | 🛑 BLOCKER | Last meaningful edit can be lost during reload/closure. |
| `test/draft-writer.test.js` | 7-34 | Only proves invocation, not failed/unload delivery | ⚠️ Warning | Passing test overstates browser-interruption coverage. |
| `test/round-store.test.js` | — | No injected write/sync/close/rename/mkdir failure coverage | ⚠️ Warning | Crash/partial-write claim is present but behavior-unverified. |

No unreferenced `TBD`, `FIXME`, or `XXX` marker was found in Phase 9 implementation files.

### Human Verification Required

1. **macOS permission evidence**

**Test:** Inspect an isolated store fixture's `rounds/`, `quarantine/`, and snapshot modes on macOS.
**Expected:** Directories are `0700` and snapshots are `0600`; do not infer Linux, Windows, or power-loss support.
**Why human:** Plan 09-04 explicitly defers this platform-scoped inspection. The verifier's macOS probe observed the expected modes, but it cannot promote that observation to another OS or a power-loss guarantee.

2. **Atomic filesystem-failure recovery**

**Test:** Inject failures at write, fsync, close, rename, lock, and directory creation, then reload the same store.
**Expected:** A prior named valid snapshot remains recoverable; temporary artifacts are ignored/cleaned and the affected record has a typed error without hiding healthy siblings.
**Why human:** No deterministic regression exercises these failure paths. This is a required automated fix, not a claim established by the macOS run.

### Gaps Summary

`b41557a` genuinely fixes reconnecting-state hydration and removes unsafe stale-lock takeover. It does not complete DUR-02: an immediate draft fetch is merely started, not made durable. If the request rejects or is aborted during page reload/closure, `DraftWriter` clears the only copy and no later edit is required to demonstrate the loss. The existing immediate-unmount test uses a successful fake `save()` and therefore cannot establish the user-facing interruption guarantee.

DUR-03 remains deliberately unverified for individual filesystem failure paths. Documentation is honest: this verification makes no Linux/Windows, universal crash, power-loss, or Claude Code availability claim. Claude-specific acceptance belongs to the later adapter-evidence phase and was not available in this Codex workspace.

---

_Verified: 2026-07-17T11:23:37Z_
_Verifier: the agent (gsd-verifier)_
