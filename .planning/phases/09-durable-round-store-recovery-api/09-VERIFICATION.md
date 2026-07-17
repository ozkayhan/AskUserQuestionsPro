---
phase: 09-durable-round-store-recovery-api
verified: 2026-07-17T11:11:07Z
status: gaps_found
score: 13/15 must-haves verified
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/5
  gaps_closed:
    - "Fresh Bridge hydration of an unfinished detached durable round"
    - "Selector-less latest-result recovery fallback"
    - "Legacy active-round recovery across a bridge restart"
    - "Overstated macOS evidence and stale durable-persistence documentation"
  gaps_remaining:
    - "A browser edit can be discarded on refresh or closure before its delayed draft save starts."
  regressions: []
gaps:
  - truth: "Meaningful answer edits survive browser refresh, reconnect, closure, host detach, and bridge restart as revisions of the same round."
    status: failed
    reason: "The browser waits 250 ms before POST /draft, then cancels that timer on Flow unmount. Refreshing or closing immediately after an edit sends no draft request; failed draft requests are swallowed without retry."
    artifacts:
      - path: "web/app.js"
        issue: "Lines 66-78 debounce draft persistence and cleanup cancels pending work on unmount."
      - path: "web/live.js"
        issue: "postDraft has no timeout/retry contract; the caller suppresses every rejection."
    missing:
      - "Durably flush or preserve the latest changed draft before refresh/closure, with a tested recovery path."
      - "Expose and retry failed draft persistence rather than silently discarding it."
behavior_unverified_items:
  - truth: "A crash or partial write leaves the prior named snapshot usable while the affected record has a safe recovery outcome."
    test: "Inject write, fsync, close, rename, lock, and directory-creation failures against RoundStore/atomic-write, then reload the store."
    expected: "The previous named valid snapshot remains available; temporary artifacts are ignored/cleaned; the failing record yields a typed persistence or recovery error without hiding healthy records."
    why_human: "Current tests prove normal atomic reload, unwritable-target cleanup, and corruption quarantine, but do not exercise the individual filesystem failure paths. The macOS evidence explicitly states this limitation."
---

# Phase 9: Durable Round Store & Recovery API Verification Report

**Phase Goal:** Users can reopen an exact saved round and safely retrieve its final answer after browser, host, or bridge interruption.
**Verified:** 2026-07-17T11:11:07Z
**Status:** gaps_found
**Re-verification:** Yes — after `b71b920`

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Meaningful edits survive interruption/restart as revisions of the same round. | ✗ FAILED | Server draft/restart tests pass, but `web/app.js:66-78` defers save 250 ms and cancels it on unmount. An immediate refresh/closure loses the latest edit. |
| 2 | A user selects an exact recoverable round; no latest-round guess occurs. | ✓ VERIFIED | `Bridge.waitForAnswers()` rejects absent selectors; `/resume`, `resumeBridge()`, and MCP `resume` require `requestId` or `roundId`. Focused exact-selector test passes. |
| 3 | Crash/partial-write/corrupt-record handling preserves healthy recoverable records and safely handles the bad record. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Per-record corruption quarantine and healthy-sibling survival pass. Atomic code uses temp → fsync → close → rename and ignores `*.tmp.*`, but no test injects write/sync/close/rename/mkdir failure. |
| 4 | A submitted answer is immutable and result/acknowledgement retries are safe. | ✓ VERIFIED | Record transitions reject changed final retries, replay identical results, and preserve the first acknowledgement fact. Focused tests and restarted-store result replay pass. |
| 5 | Existing pre-v1.1 requests enter the durable model without cross-round loss. | ✓ VERIFIED | A no-`requestId` probe created an opaque durable record with `migration.legacyRegistration: true` and returned the unchanged `{ answers }` envelope; ID/capability guards remain in the answer path. |
| 6 | Registration creates a versioned private snapshot before visibility. | ✓ VERIFIED | `Bridge.submitQuestions()` calls `RoundStore.create()` before resolving `peek`; record tests cover version, opaque ID, revision, lifecycle, and expiry. |
| 7 | Each accepted persisted mutation advances revision once; idempotent/conflicting retries do not overwrite it. | ✓ VERIFIED | `Record.saveDraft`, `finalize`, and `acknowledge` implement monotonic revision/replay behavior; draft/revision focused tests pass. |
| 8 | Initial durable retention follows the resolved detached-round TTL. | ✓ VERIFIED | Bridge passes its resolved TTL to `RoundStore.create`; `Record.create()` derives `expiresAt` from it. |
| 9 | Lifecycle transitions persist before success is reported. | ✓ VERIFIED | Bridge delegates draft, detach/resume, answer, uncertain delivery, acknowledgement, cancellation, and expiry mutations through `RoundStore.mutate()`. |
| 10 | Legacy and established successful envelopes remain compatible while unsafe recovery is typed. | ✓ VERIFIED | `/ask`, `/answer`, `/cancel`, and successful `/resume` retain their response shapes; absent selectors return `invalid_selector`. |
| 11 | Invalid/expired/missing/ambiguous/unauthorized recovery requests are redacted typed errors. | ✓ VERIFIED | `recoveryError()` maps selector and ownership failures without exposing persisted payloads; server coverage passes. |
| 12 | Maintained docs describe exact selection, results, acknowledgement, retention, quarantine, and Node authority. | ✓ VERIFIED | `docs/api.md` and D-010 match routes and retention; browser storage is explicitly non-authoritative. |
| 13 | macOS evidence is bounded and does not claim Linux/Windows/power-loss validation. | ✓ VERIFIED | `docs/evidence/phase-09-durable-recovery.md` explicitly limits scope to macOS and calls out untested fault injection. |
| 14 | Support docs keep discovery and recovery outcomes redacted. | ✓ VERIFIED | Discovery documentation limits output to metadata and excludes questions, answers, capabilities, and paths. |
| 15 | Existing store directories and snapshots use restrictive permissions. | ✓ VERIFIED | Direct macOS probe observed `rounds=700`, `quarantine=700`, `snapshot=600`; store also tightens pre-existing directories. |

**Score:** 13/15 truths verified (1 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `lib/round-record.cjs` | Versioned records, revision guards, immutable result/ack facts | ✓ VERIFIED | Substantive validated transition module, used by store and bridge. |
| `lib/round-store.cjs` | Private atomic snapshots, scan, quarantine, TTL cleanup | ✓ VERIFIED | Store startup loads/validates each record, quarantines only invalid records, tightens directories, and deletes expired files. |
| `lib/atomic-write.cjs` | Same-directory sync/close/rename and ownership-safe locking | ✓ VERIFIED | Owner-token lock requires both stale age and dead owner; release verifies ownership. Focused stale/dead and stale/live tests pass. |
| `server/bridge.js` | Store-backed draft/restart/recovery/result lifecycle | ✓ VERIFIED | Hydrates a unique recoverable record at construction and can hydrate an explicitly selected record on demand. |
| `server/server.js` | Exact recovery, draft, result, acknowledgement HTTP contracts | ✓ VERIFIED | Routes validate selectors/capabilities and delegate to Bridge. |
| `web/live.js`, `web/app.js` | Browser draft persistence | ✗ HOLLOW | `/draft` is wired, but debouncing plus unmount cancellation leaves a last-edit loss window and hides failure. |
| `test/round-record.test.js`, `test/round-store.test.js`, `test/bridge.test.js`, `test/server.test.js`, `test/settings.test.js` | Focused durable regression coverage | ✓ VERIFIED | 128 focused tests pass, covering all requested deterministic server/store paths except injected filesystem failure cases. |
| `docs/evidence/phase-09-durable-recovery.md` | Honest bounded platform evidence | ✓ VERIFIED | Accurately documents macOS-only result and omitted fault-injection coverage. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `RoundStore` | `writeFileAtomic` | `_write()` | ✓ WIRED | Record enters `_records` only after atomic writer success. |
| `Bridge` | `RoundStore` | registration, draft, transition, finalization, acknowledgement | ✓ WIRED | Durable mutations precede the relevant bridge success path. |
| Fresh store | fresh `Bridge` | constructor hydration and `_recover()` | ✓ WIRED | Child-server restart test hydrates a detached draft for `/current` and exact `/resume`. |
| Browser Flow | `/draft` | `postDraft()` | ⚠️ PARTIAL | Request/response contract is wired, but scheduled work is cancelled on refresh/close and errors are swallowed. |
| Host adapters | explicit selector | `resumeBridge()` and MCP `resume` | ✓ WIRED | Both pass exact request/round selector material; no selector-less fallback remains. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `RoundStore` | `_records` | `rounds/*.json` validated scan | Yes | ✓ FLOWING |
| `Bridge` | `_pending` | created record or durable hydration | Yes | ✓ FLOWING |
| Browser `Flow` | `answers` / `draftRevision` | React state → debounced `/draft` | Not before unmount; failed save has no retry | ✗ HOLLOW |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Focused durable/recovery suite | `node --test test/round-record.test.js test/round-store.test.js test/bridge.test.js test/server.test.js test/settings.test.js` | 128 passed, 0 failed | ✓ PASS |
| Full workspace suite | `npm test` | 427 passed, 0 failed | ✓ PASS |
| Restart detached recovery, draft, revision, exact selection, corruption/expiry, lock, immutable replay | targeted `node --test --test-name-pattern=...` | 8 passed, 0 failed | ✓ PASS |
| Private modes | isolated `RoundStore` probe | `rounds=700`, `quarantine=700`, `snapshot=600` | ✓ PASS (macOS) |
| Legacy migration envelope | isolated `Bridge`/`RoundStore` probe | durable opaque ID, `legacyRegistration=true`, `requestId=null`, original answer envelope | ✓ PASS |
| Browser immediate refresh/closure after edit | source-path inspection of `Flow` effect | timer is cancelled on cleanup before `/draft` starts | ✗ FAIL |
| Lint / formatting | `npm run lint`; `npm run format:check` | `eslint` and `prettier` executables absent from this checkout | ? ENVIRONMENT LIMITATION |

### Probe Execution

No Phase 9 `scripts/**/tests/probe-*.sh` probes are declared or present.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
| --- | --- | --- | --- |
| DUR-01 | 09-01, 09-02 | ✓ SATISFIED | Authoritative versioned local snapshots are created before registration becomes visible. |
| DUR-02 | 09-01, 09-02 | ✗ BLOCKED | Server revisions work, but browser closure/refresh can cancel an unsent meaningful edit. |
| DUR-03 | 09-01, 09-02, 09-04 | ? NEEDS HUMAN / MORE TESTS | Corruption/quarantine and normal atomic reload are proven; individual crash/partial-write failure paths have no injected behavioral evidence. |
| DUR-04 | 09-03 | ✓ SATISFIED | Exact selectors are required across Bridge, HTTP client, and MCP. |
| DUR-05 | 09-02, 09-03, 09-04 | ✓ SATISFIED | Final answer immutability and duplicate result/ack replay are persisted and tested. |
| DUR-06 | 09-02, 09-03 | ✓ SATISFIED | Legacy no-request-ID registration remains compatible while persisting a durable record. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `web/app.js` | 66–78 | Delayed draft write is cancelled on unmount | 🛑 Blocker | Violates DUR-02 for immediate refresh/tab closure. |
| `web/app.js` | 75 | Empty rejection handler for draft persistence | ⚠️ Warning | A failed save is neither surfaced nor retried. |
| `docs/evidence/phase-09-durable-recovery.md` | 25–26 | Explicitly omits injected filesystem-failure tests | ⚠️ Warning | Honest evidence, but DUR-03's crash-path behavior remains unexercised. |

### Human Verification Required

No separate UAT item is emitted because the failure above is directly observable from the browser draft-save control flow. The DUR-03 behavior-unverified item in the frontmatter requires deterministic failure tests (preferred) or an explicit developer decision; macOS-only evidence does not establish Linux/Windows or power-loss behavior.

### Gaps Summary

`b71b920` closes the prior restart hydration, exact-selector, legacy-restart, private-directory, stale-lock, and documentation-evidence findings. The phase still cannot pass: the only browser draft path intentionally delays persistence and then cancels it when the browser refreshes or closes. That conflicts with the Phase 9 success criterion that meaningful edits survive refresh and closure.

No later phase explicitly defers this durability guarantee. Phase 11 owns recovery presentation and delivery UX, not the Phase 9 requirement to persist a meaningful edit before it can be lost. The filesystem evidence remains correctly limited to macOS; Claude host acceptance was unavailable in this Codex-only workspace and is not claimed.

---

_Verified: 2026-07-17T11:11:07Z_
_Verifier: the agent (gsd-verifier)_
