---
phase: 09-durable-round-store-recovery-api
verified: 2026-07-17T11:36:39Z
status: gaps_found
score: 14/15 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 13/15
  gaps_closed:
    - "Meaningful answer edits survive an aborted immediate draft transport by being retained locally and replayed after reload."
    - "Atomic-write tests now inject open, write, fsync, close, rename, and mkdir failures."
  gaps_remaining:
    - "Dead-lock recovery can delete a lock newly acquired by a live competing writer after the stale claimant's inode check."
  regressions: []
gaps:
  - truth: "A crash, partial write, or corrupt persisted record leaves recoverable records intact and presents a safe recovery error for the bad record."
    status: failed
    reason: "The stale-lock recovery protocol has a check-then-unlink race. A competing recovery can remove the dead lock and install a live lock after the first claimant verifies inode identity; the first claimant then unlinks that live lock and writes concurrently."
    artifacts:
      - path: "lib/atomic-write.cjs"
        issue: "recoverStaleLock() performs statSync(lockPath)/statSync(claim) before a non-atomic unlinkSync(lockPath); no ownership-safe handoff protects a replacement lock."
      - path: "test/settings.test.js"
        issue: "The takeover test aborts before recoverStaleLock() can link, inspect, and unlink a stale lock, so it does not exercise the claimed critical interleaving."
    missing:
      - "Replace check-then-unlink stale-lock reclamation with an ownership-safe handoff that cannot unlink a pathname reacquired by another live writer."
      - "Add a deterministic two-contender regression that replaces the public lock after claimant inode verification and proves the replacement remains present and the claimant fails closed."
---

# Phase 9: Durable Round Store & Recovery API Verification Report

**Phase Goal:** Users can reopen an exact saved round and safely retrieve its final answer after browser, host, or bridge interruption.
**Verified:** 2026-07-17T11:36:39Z
**Status:** gaps_found
**Re-verification:** Yes — after `21f86c1`

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Meaningful answer edits survive browser refresh, reconnect, closure, host detach, and bridge restart as revisions of the same round. | ✓ VERIFIED | `DraftWriter` persists an unacknowledged local mirror before sending, `postDraft()` uses `keepalive` for small bodies, and `draft writer replays an immediately aborted edit after reload` passes. Bridge restart and reconnecting restart regressions pass. |
| 2 | A user can choose a specific recoverable round rather than the product guessing a “latest” round. | ✓ VERIFIED | `resumeBridge()` rejects selector-less calls; bridge/server and MCP resume tests require exact request/round selectors. |
| 3 | A crash, partial write, or corrupt persisted record leaves recoverable records intact and presents a safe recovery error for the bad record. | ✗ FAILED — BLOCKER | Fault injection and corrupt-sibling quarantine pass, but stale-lock recovery can delete a newly acquired live lock; direct reproduction below proves concurrent writes become possible. |
| 4 | A submitted answer cannot be changed by a retry, and result retrieval or delivery acknowledgement can be safely repeated. | ✓ VERIFIED | `round-record`, bridge, and server regressions prove immutable final results, matching replay, and one persisted acknowledgement fact across retries/restart. |
| 5 | Existing pre-v1.1 requests continue into the durable recovery model without cross-round loss. | ✓ VERIFIED | Legacy numeric IDs remain in-process compatibility tokens while registration maps to a durable opaque round; focused bridge/server coverage passes. |
| 6 | A newly registered durable round has a versioned private snapshot, opaque stable identity, revision, lifecycle, expiry, and TTL-derived retention. | ✓ VERIFIED | `round-record`/`round-store` tests and Bridge creation path pass; direct macOS probe observed `0700` rounds/quarantine and `0600` snapshot modes. |
| 7 | Each meaningful persisted mutation advances revision once; retries and immutable-result conflicts cannot overwrite newer data. | ✓ VERIFIED | Pure record transition tests and guarded `/draft` server regression pass. |
| 8 | Bad snapshots are quarantined individually without hiding healthy siblings. | ✓ VERIFIED | `bad records are quarantined individually while healthy siblings remain` passes. |
| 9 | Registration and every authoritative lifecycle mutation commit before success is reported. | ✓ VERIFIED | `Bridge` delegates create/draft/detach/resume/finalize/ack/cancel through `RoundStore`; committed state is exposed only after `_write()` succeeds. |
| 10 | A fresh Bridge hydrates recoverable drafting, detached, and reconnecting rounds from the store, not browser storage. | ✓ VERIFIED | Repeated restart regression completes detach → resume/reconnecting → restart → resume → answer. |
| 11 | Discovery/recovery is redacted, exact, capability-guarded, and produces typed errors for invalid selectors. | ✓ VERIFIED | Server and client tests cover redacted discovery, no latest fallback, stale/missing/unauthorized conditions, and exact recovery. |
| 12 | Docs accurately describe exact selection, results/acknowledgement, retention, quarantine, Node authority, and bounded platform/host scope. | ✓ VERIFIED | API/decision/evidence docs match routes and explicitly bound claims to macOS filesystem evidence; no Linux, Windows, power-loss, or live Claude acceptance claim is made. |
| 13 | Existing directories and snapshots use restrictive permissions. | ✓ VERIFIED | Store chmods reused directories; focused test and direct macOS probe report `rounds=0700`, `quarantine=0700`, `snapshot=0600`. |
| 14 | The browser draft flow is wired to the durable draft API and has real input data. | ✓ VERIFIED | React `answers` state feeds `DraftWriter`, which calls `postDraft()` with round/capability/revision; server `/draft` persists the real answers projection. |
| 15 | Crash-created dead locks can be reclaimed without displacing a live owner. | ✗ FAILED — BLOCKER | Dead-PID recovery itself passes, but live-owner protection fails under the post-inode-check replacement interleaving. |

**Score:** 14/15 must-haves verified (0 present, behavior-unverified).

## Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `lib/round-record.cjs` | Versioned record, revisions, immutable result/ack | ✓ VERIFIED | Substantive validation and pure transition chokepoint exercised by record/store/bridge. |
| `lib/round-store.cjs` | Private snapshots, scan, quarantine, expiry cleanup | ✓ VERIFIED | Uses atomic writer before map mutation; healthy records remain discoverable after invalid sibling and mkdir fault. |
| `lib/atomic-write.cjs` | fsync/close/rename atomic replacement and safe lock recovery | ✗ BLOCKER | File-write fault cleanup passes, but stale-lock live-owner safety is broken by a reproducible race. |
| `server/bridge.js` | Durable lifecycle and restart hydration | ✓ VERIFIED | Create-before-visible, durable mutation, exact recovery, repeated reconnecting restart coverage. |
| `server/server.js` | Exact redacted recovery/draft/result/ack contracts | ✓ VERIFIED | Capability/revision selectors and typed errors are wired through Bridge. |
| `web/app.js`, `web/live.js`, `web/draft-writer.js` | Abort/reload-safe draft delivery | ✓ VERIFIED | Local mirror stays until matching revision acknowledgement; test exercises rejected first transport and next-instance replay. |
| `test/*.test.js` Phase 9 coverage | Regression proof for durability contract | ⚠️ PARTIAL | 158 focused and 438 full tests pass; the purported takeover test misses the actual stale-claim race. |
| Durable API/decision/evidence docs | Honest recovery and platform/host scope | ✓ VERIFIED | Scope is deliberately macOS-only and says Claude host acceptance was unavailable in this Codex-only workspace. |

## Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `RoundStore` | `writeFileAtomic` | `_write()` before `_records.set()` | ✓ WIRED | A failed write returns `persistence_error` without advancing live store state. |
| `Bridge` | `RoundStore` | registration, draft, lifecycle, result, acknowledgement | ✓ WIRED | Store-backed transitions precede Bridge success. |
| Fresh store | fresh `Bridge` | constructor hydration / recoverable records | ✓ WIRED | Reconnecting restart test passes. |
| Browser `Flow` | `/draft` | `DraftWriter` → `postDraft()` | ✓ WIRED | Dynamic React answers are mirrored, sent, and replayed after abort. |
| Host adapters | explicit selector | `resumeBridge()` / MCP resume | ✓ WIRED | Selector-less latest-round recovery is rejected. |

## Data-Flow Trace

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `RoundStore` | `_records` | Validated `rounds/*.json` scan | Yes | ✓ FLOWING |
| `Bridge` | `_pending` | New or hydrated durable record | Yes | ✓ FLOWING |
| Browser `Flow` | `answers` / revision | React state → local replay mirror → `/draft` → RoundStore | Yes | ✓ FLOWING |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Focused Phase 9 tests | `node --test test/round-record.test.js test/round-store.test.js test/bridge.test.js test/server.test.js test/settings.test.js test/bridge-client.test.js test/mcp-long-round.test.js test/draft-writer.test.js test/live.test.js` | 158 passed, 0 failed | ✓ PASS |
| Full workspace tests | `npm test` | 438 passed, 0 failed | ✓ PASS |
| Reconnecting repeated restart | focused `Bridge resumes a reconnecting browser round after a second bridge restart` | Passed | ✓ PASS |
| Immediate draft abort/reload replay | focused `draft writer replays an immediately aborted edit after reload...` | Passed | ✓ PASS |
| Exact selectors | bridge/server/MCP focused cases | No selector-less fallback; exact selector succeeds | ✓ PASS |
| Quarantine and retention | focused store cases | Healthy sibling retained; expired snapshot removed only | ✓ PASS |
| Permissions | isolated macOS RoundStore probe | `rounds=0700`, `quarantine=0700`, `snapshot=0600` | ✓ PASS (macOS only) |
| Open/write/fsync/close/rename/mkdir faults | focused atomic/store cases | Prior named snapshot preserved; temporary and lock artifacts cleaned | ✓ PASS |
| Immutable result/ack | focused record/bridge/server cases | Matching result and acknowledgement replay preserves final facts | ✓ PASS |
| Crash dead lock / live owner protection | direct injected recovery interleaving | `{"injected":true,"recoveredWriteSucceeded":true,"liveLockStillExists":false,"final":"{\"revision\":2}"}` | ✗ FAIL |
| Lint / formatting | `npm run lint`; `npm run format:check` | Both exit 127 because `eslint` and `prettier` are absent from this checkout | ? ENVIRONMENT LIMITATION |
| Diff integrity | `git diff --check` | Exit 0 | ✓ PASS |

## Probe Execution

No Phase 9 `scripts/**/tests/probe-*.sh` probe is declared or present.

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- |
| DUR-01 | 09-01, 09-02 | Server maintains authoritative versioned local round records. | ✓ SATISFIED | Store-backed registration, mutation, and hydration pass. |
| DUR-02 | 09-01, 09-02 | Meaningful edits persist incrementally with revisions. | ✓ SATISFIED | Abort/reload replay and guarded incremental draft persistence pass. |
| DUR-03 | 09-01, 09-02, 09-04 | Records survive restart, crash recovery, partial writes, and corruption through atomic snapshots and quarantine. | ✗ BLOCKED | A stale recovery contender can remove a newly acquired live lock, enabling unsafe concurrent writes. |
| DUR-04 | 09-03 | Exact recoverable-round selection; no arbitrary latest behavior. | ✓ SATISFIED | Exact selector requirement and redacted discovery/recovery tests pass. |
| DUR-05 | 09-02, 09-03 | Immutable final answer and idempotent result/ack. | ✓ SATISFIED | Replay semantics pass before and after restart. |
| DUR-06 | 09-02, 09-03 | Safe legacy migration. | ✓ SATISFIED | Legacy registration remains compatible and maps durably. |

No Phase 9 requirement is orphaned from its plans. Later phases do not specifically defer this Phase 9 lock-safety failure; it remains actionable here.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `lib/atomic-write.cjs` | 47-53 | Inode check followed by non-atomic public-lock unlink | 🛑 BLOCKER | Can delete a live competitor’s lock and permit concurrent overwrites. |
| `test/settings.test.js` | 458-480 | Mock takeover bypasses stale recovery path | ⚠️ Warning | Passing test does not test the safety claim it names. |

No unreferenced `TBD`, `FIXME`, or `XXX` marker was found in Phase 9 implementation files.

## Human Verification / Scope Boundary

The Phase 9 plan defers a macOS permission inspection. The verifier independently observed the requested `0700/0700/0600` modes on macOS. This does not extend to Linux, Windows, ACL semantics, power loss, remote filesystems, or a live Claude Code host run; the maintained docs accurately state those limits.

## Gaps Summary

`21f86c1` closes the prior draft-loss gap and adds genuine individual filesystem-failure tests. It does **not** make stale-lock recovery safe: the claim link only preserves a reference to the dead inode; it does not reserve the public pathname after the identity check. A second contender can reclaim the dead lock, create a live replacement, and then have that replacement unlinked by the first contender. The direct reproduction shows the first writer succeeds and the live lock disappears.

This is a **BLOCKER** for DUR-03 and the Phase 9 goal. Do not proceed to Phase 10 until stale-lock ownership transfer is made race-safe and covered by the exact two-contender regression.

---

_Verified: 2026-07-17T11:36:39Z_
_Verifier: the agent (gsd-verifier)_
