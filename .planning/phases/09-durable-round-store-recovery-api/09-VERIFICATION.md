---
phase: 09-durable-round-store-recovery-api
verified: 2026-07-17T11:46:49Z
status: passed
score: 15/15 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 14/15
  gaps_closed:
    - "Crash-created dead locks can be reclaimed without displacing a live owner."
  gaps_remaining: []
  regressions: []
---

# Phase 9: Durable Round Store & Recovery API Verification Report

**Phase Goal:** Users can reopen an exact saved round and safely retrieve its final answer after browser, host, or bridge interruption.
**Verified:** 2026-07-17T11:46:49Z
**Status:** passed
**Re-verification:** Yes — after `0325d4e`

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Meaningful answer edits survive browser refresh, reconnect, closure, host detach, and bridge restart as revisions of the same round. | ✓ VERIFIED | `DraftWriter` persists a round/capability/revision-keyed mirror before transport; `postDraft()` sends the durable `/draft` request; the abort/reload replay and repeated restart tests pass. |
| 2 | A user can choose a specific recoverable round rather than the product guessing a “latest” round. | ✓ VERIFIED | `resumeBridge()`, MCP resume, Bridge, and `POST /resume` reject selector-less recovery; exact `roundId`/unique `requestId` paths are covered by bridge, server, client, and MCP tests. |
| 3 | A crash, partial write, or corrupt persisted record leaves recoverable records intact and presents a safe recovery error for the bad record. | ✓ VERIFIED | Same-directory temp/sync/close/rename writes preserve the named snapshot on injected open/write/fsync/close/rename failures; corrupt siblings quarantine independently; directory locks recover only confirmed-dead owners without the former live-owner deletion race. |
| 4 | A submitted answer cannot be changed by a retry, and result retrieval or delivery acknowledgement can be safely repeated. | ✓ VERIFIED | `Record.finalize()` rejects changed retries, while `acknowledge()` returns the original timestamp/revision; Bridge/server restart and HTTP result/ack tests pass. |
| 5 | Existing pre-v1.1 requests continue into the durable recovery model without cross-round loss. | ✓ VERIFIED | Registration preserves the numeric in-process token and legacy `{ answers }` success envelope while creating a durable record containing the request ID and migration marker. |
| 6 | A newly registered durable round has a versioned private snapshot, opaque stable identity, revision, lifecycle, expiry, and TTL-derived retention. | ✓ VERIFIED | `round-record` validation and `RoundStore` persistence tests cover v1 records; macOS evidence records `0700` directories and `0600` snapshots. |
| 7 | Each meaningful persisted mutation advances revision once; retries and immutable-result conflicts cannot overwrite newer data. | ✓ VERIFIED | Pure record transitions plus guarded `/draft` and Bridge tests exercise stale revisions, idempotent draft replay, and immutable final results. |
| 8 | Bad snapshots are quarantined individually without hiding healthy siblings. | ✓ VERIFIED | `RoundStore._load()` validates each named JSON record independently and moves only invalid files into `quarantine`; the healthy-sibling regression passes. |
| 9 | Registration and every authoritative lifecycle mutation commit before success is reported. | ✓ VERIFIED | `RoundStore._write()` calls `writeFileAtomic()` before updating `_records`; Bridge create/draft/transition/finalize/ack paths return failure before exposing uncommitted state. |
| 10 | A fresh Bridge hydrates recoverable drafting, detached, and reconnecting rounds from the store, not browser storage. | ✓ VERIFIED | Constructor hydration and exact recovery use `RoundStore.recoverable()`; the detach → reconnect → second restart → resume regression passes. |
| 11 | Discovery/recovery is redacted, exact, capability-guarded, and produces typed errors for invalid selectors. | ✓ VERIFIED | `GET /rounds` returns metadata only, content-bearing result/ack routes require capability, and server tests cover invalid/missing/expired/mismatched selectors. |
| 12 | Docs accurately describe exact selection, results/acknowledgement, retention, quarantine, Node authority, and bounded platform/host scope. | ✓ VERIFIED | `docs/api.md`, `docs/decisions.md`, and the Phase 9 evidence document match the routes and explicitly limit filesystem evidence to macOS. |
| 13 | Existing directories and snapshots use restrictive permissions. | ✓ VERIFIED | `_ensure()` chmods reused `rounds`/`quarantine` directories to `0700`; snapshot writes use `0600`; store tests and macOS evidence pass. |
| 14 | The browser draft flow is wired to the durable draft API and has real input data. | ✓ VERIFIED | React `answers` state feeds `DraftWriter`, which invokes `postDraft(roundId, draft, capability, revision)`; `/draft` delegates to `Bridge.saveDraft()` and persists the actual projection. |
| 15 | Crash-created dead locks can be reclaimed without displacing a live owner. | ✓ VERIFIED | `0325d4e` replaces the racy file-lock unlink with a directory lease: owner removal followed by atomic `rmdir`; the deterministic contender test proves a replacement lease survives and the recovering writer fails closed. |

**Score:** 15/15 truths verified (0 present, behavior-unverified).

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `lib/round-record.cjs` | Versioned record, revisions, immutable result/ack | ✓ VERIFIED | 184 substantive lines; required by store and Bridge; record tests cover validation and pure transitions. |
| `lib/round-store.cjs` | Private snapshots, scan, quarantine, expiry cleanup | ✓ VERIFIED | 123 substantive lines; server constructs it at startup; real record data flows from disk into hydration/listing. |
| `lib/atomic-write.cjs` | Fsync/close/rename atomic replacement and safe lock recovery | ✓ VERIFIED | 161 substantive lines; store uses it for each write; fault, dead-lock, and two-contender tests pass. |
| `server/bridge.js` | Durable lifecycle and restart hydration | ✓ VERIFIED | Store-backed create/mutate/hydrate paths are wired to the server and covered by restart and replay tests. |
| `server/server.js` | Exact redacted recovery/draft/result/ack contracts | ✓ VERIFIED | Routes pass exact selectors/ownership material into Bridge and expose typed responses. |
| `web/app.js`, `web/live.js`, `web/draft-writer.js` | Abort/reload-safe draft delivery | ✓ VERIFIED | Dynamic React answers flow through a retained local mirror and durable `/draft` acknowledgement. |
| Durable API/decision/evidence docs | Accurate recovery and bounded platform scope | ✓ VERIFIED | Documents name exact routes and limits; no Linux/Windows, universal power-loss, or live-Claude claim appears. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `RoundStore` | `writeFileAtomic` | `_write()` before `_records.set()` | ✓ WIRED | Failed writes produce `persistence_error` without advancing the in-memory authoritative map. |
| `Bridge` | `RoundStore` | registration, draft, lifecycle, result, acknowledgement | ✓ WIRED | Durable transitions run before success is returned to browser/host callers. |
| Fresh store | fresh `Bridge` | constructor hydration / exact recovery | ✓ WIRED | Reconnecting round survives a second restart in the named regression. |
| Browser `Flow` | `/draft` | `DraftWriter` → `postDraft()` | ✓ WIRED | Real `answers` React state is persisted, retained locally on abort, then replayed. |
| Host adapters | explicit selector | `resumeBridge()` / MCP resume | ✓ WIRED | Both enforce an exact request or durable-round selector; no latest-round fallback remains. |

### Data-Flow Trace

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `RoundStore` | `_records` | Validated `rounds/*.json` snapshots | Yes | ✓ FLOWING |
| `Bridge` | `_pending` / `durable` | Newly created or hydrated store record | Yes | ✓ FLOWING |
| Browser `Flow` | `answers` / revision | React state → local mirror → `/draft` → RoundStore | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Focused Phase 9 suite | `node --test test/round-record.test.js test/round-store.test.js test/bridge.test.js test/server.test.js test/settings.test.js test/bridge-client.test.js test/mcp-long-round.test.js test/draft-writer.test.js test/live.test.js` | 158 passed, 0 failed | ✓ PASS |
| Full workspace suite | `npm test` | 438 passed, 0 failed | ✓ PASS |
| Stale-lock contender and crash recovery | `node --test --test-name-pattern='crash-created dead-owner lock|stale directory recovery cannot remove' test/settings.test.js` | 2 passed; a dead lease is reclaimed and a post-`rmdir` contender lease remains intact | ✓ PASS |
| Immediate draft abort/replay and repeated restart hydration | `node --test --test-name-pattern='replays an immediately aborted|second bridge restart' test/draft-writer.test.js test/bridge.test.js` | 2 passed | ✓ PASS |
| Fault injection | Focused settings/store tests | open, write, fsync, close, rename, and mkdir failure paths preserve healthy records and clean artifacts | ✓ PASS |
| Exact selectors, quarantine/retention/permissions, immutable ack, legacy migration | Focused bridge/server/store/record/client/MCP tests | Named regressions pass with no latest-round fallback or cross-round disclosure | ✓ PASS |
| Diff integrity | `git diff --check 0325d4e^ 0325d4e` | Exit 0 | ✓ PASS |

### Probe Execution

No Phase 9 `scripts/**/tests/probe-*.sh` probe is declared or present.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| DUR-01 | 09-01, 09-02 | Server maintains authoritative versioned local round records. | ✓ SATISFIED | Durable store is constructed by the server; registration and hydration pass. |
| DUR-02 | 09-01, 09-02 | Meaningful edits persist incrementally with revisions. | ✓ SATISFIED | `/draft`, revision guards, immediate-abort replay, and restart tests pass. |
| DUR-03 | 09-01, 09-02, 09-04 | Records survive restart, crash recovery, partial writes, and corruption through atomic snapshots and quarantine. | ✓ SATISFIED | Fault injection, dead-lock reclamation, contender safety, restart, and corrupt-sibling quarantine pass. |
| DUR-04 | 09-03 | Exact recoverable-round selection; no arbitrary latest behavior. | ✓ SATISFIED | Bridge/server/client/MCP enforce selectors and redacted discovery. |
| DUR-05 | 09-02, 09-03 | Immutable final answer and idempotent result/ack. | ✓ SATISFIED | Record, Bridge, and HTTP replay semantics pass across restart. |
| DUR-06 | 09-02, 09-03 | Safe legacy migration. | ✓ SATISFIED | Legacy registration maps to an exact durable record without changing successful answer envelopes. |

No Phase 9 requirement is orphaned from its plans. No gap is deferred to Phase 10 or later; later phases add settings, UX, adapters, and cross-platform evidence rather than completing a Phase 9 durability defect.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `test/settings.test.js` | 518-532 | The live-owner regression retains a legacy file-lock fixture, not a live directory-lease fixture. | ℹ️ Info | It proves conservative compatibility handling; the separate deterministic directory-contender test proves the Phase 9 ownership-safety invariant. |

No unreferenced `TBD`, `FIXME`, or `XXX` marker was found in Phase 9 implementation files. The stale-lock ownership safety claim is behaviorally exercised, so no human verification item remains.

### Disconfirmation Pass

- **Partial-requirement check:** The prior DUR-03 race was rechecked against the new implementation, not accepted from the final review. The public lock is now an atomic directory lease, so a contender cannot take the name during stale owner removal; if it takes the name after `rmdir`, the recovery writer gets `EEXIST` and fails closed.
- **Misleading-test check:** The legacy file-lock “live writer” test is not evidence for a live directory lease. The new deterministic contender regression supplies the relevant assertion: it attempts acquisition while the stale directory exists, installs a contender only after `rmdir`, and verifies the recovering writer does not remove it.
- **Error-path check:** Injection covers the required open/write/fsync/close/rename/mkdir failures. A lease-file write failure can leave an empty lock directory, but recovery handles an empty directory only with atomic `rmdir`, so it remains fail-closed and is reclaimable on a subsequent write; this does not expose concurrent writes or corrupt the named snapshot.

## Gaps Summary

None. `0325d4e` closes the only previous blocker by replacing stale file-lock unlinking with ownership-safe directory leases. All roadmap success criteria, Plan 9 must-haves, and DUR-01 through DUR-06 have direct code, wiring, data-flow, and passing behavioral evidence.

---

_Verified: 2026-07-17T11:46:49Z_
_Verifier: the agent (gsd-verifier)_
