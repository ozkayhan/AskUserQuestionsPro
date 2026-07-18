---
phase: 09-durable-round-store-recovery-api
verified: 2026-07-17T11:59:35Z
status: passed
score: 15/15 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 15/15
  gaps_closed:
    - "Queued draft B is re-keyed at revision 1 and replays after A succeeds and B aborts."
    - "A reused PID with mismatched Linux process-start identity is treated as a dead lease owner."
    - "Backend documentation now describes the directory-lease protocol."
  gaps_remaining: []
  regressions: []
---

# Phase 9: Durable Round Store & Recovery API Verification Report

**Phase Goal:** Users can reopen an exact saved round and safely retrieve its final answer after browser, host, or bridge interruption.
**Verified:** 2026-07-17T11:59:35Z
**Status:** passed
**Re-verification:** Yes — final verification after `e193fc7`

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Meaningful answer edits survive refresh, reconnect, closure, detach, and bridge restart as revisions of one round. | ✓ VERIFIED | `Flow` sends real React `answers` through `DraftWriter` and `/draft`; the 160-test Phase suite includes immediate-abort replay, queued A→B abort/reload replay, and repeated restart recovery. |
| 2 | A user or host chooses a specific recoverable round; no latest-round guess is made. | ✓ VERIFIED | `Bridge.waitForAnswers()` rejects selector-less recovery; `/resume`, client, and MCP tests cover exact `roundId`/unique `requestId` selection. |
| 3 | Partial-write/crash/corrupt-record failures preserve healthy records and return safe recovery outcomes. | ✓ VERIFIED | `writeFileAtomic()` uses temp → fsync → close → rename with directory leases; named open/write/fsync/close/rename faults, dead-owner recovery, contender safety, and independent quarantine tests pass. |
| 4 | Submitted answers are immutable, and result retrieval/acknowledgement are repeatable. | ✓ VERIFIED | `Record.finalize()` rejects changed retries; `acknowledge()` retains its original timestamp/revision; bridge and HTTP replay tests pass across restart. |
| 5 | Pre-v1.1 registrations migrate without cross-round loss. | ✓ VERIFIED | Registration creates a durable v1 record with its request ID/migration marker while retaining numeric process-local compatibility and `{ answers }` success envelopes. |
| 6 | A durable round has opaque identity, version, revision, lifecycle, expiry, and a private snapshot. | ✓ VERIFIED | `round-record.cjs`, `round-store.cjs`, record/store tests, and the bounded macOS evidence document verify the schema, `0700` directories, and `0600` snapshots. |
| 7 | Each material mutation advances exactly one revision; stale or conflicting writes cannot overwrite it. | ✓ VERIFIED | Record transition tests plus capability/revision-guarded `/draft` tests cover stale and idempotent replays. |
| 8 | A bad snapshot is quarantined without hiding healthy siblings. | ✓ VERIFIED | `_load()` validates each named JSON snapshot separately and moves only failures to `quarantine`; the healthy-sibling regression passes. |
| 9 | Authoritative changes commit before success becomes visible. | ✓ VERIFIED | `RoundStore._write()` updates `_records` only after `writeFileAtomic()` succeeds; Bridge mutation paths return failure on persistence error. |
| 10 | A fresh Bridge hydrates recoverable drafting/detached/reconnecting state from disk. | ✓ VERIFIED | Constructor recovery and exact selection hydrate `RoundStore.recoverable()`; detached → reconnect → second restart is tested. |
| 11 | Discovery is redacted and content-bearing recovery is exact and capability-bound. | ✓ VERIFIED | `/rounds` returns metadata only; result/ack require capability; invalid, expired, mismatched, ambiguous, and unauthorized selector tests pass. |
| 12 | Documentation accurately limits recovery and platform evidence claims. | ✓ VERIFIED | `docs/api.md`, `docs/decisions.md`, `docs/backend.md`, and the evidence file match the routes and state macOS-only, non-power-loss scope. |
| 13 | Existing directories and snapshots have restrictive permissions. | ✓ VERIFIED | `_ensure()` chmods both existing subdirectories to `0700`; atomic snapshots use `0600`; store tests pass. |
| 14 | Browser draft data is genuinely wired to durable persistence. | ✓ VERIFIED | `web/app.js` creates `DraftWriter` with actual answer state, `web/live.js` posts it, and `/draft` delegates to `Bridge.saveDraft()`. |
| 15 | Lease recovery does not displace a live/new contender and handles PID reuse safely. | ✓ VERIFIED | Directory lease recovery retires only an empty lease with `rmdir`; a deterministic contender test and mocked PID-start-identity test pass. |

**Score:** 15/15 truths verified (0 present, behavior-unverified).

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `lib/round-record.cjs` | Versioned records, revisions, immutable result/ack | ✓ VERIFIED | Schema and pure transitions are substantive and exercised by record/bridge tests. |
| `lib/round-store.cjs` and `lib/atomic-write.cjs` | Private atomic snapshots, quarantine, retention, safe leases | ✓ VERIFIED | Store calls atomic writer before cache mutation; real disk records flow into new Bridge instances. |
| `server/bridge.js` and `server/server.js` | Durable lifecycle and exact recovery API | ✓ VERIFIED | Store-backed registration/draft/result/ack transitions are routed through the HTTP boundary. |
| `web/app.js`, `web/live.js`, `web/draft-writer.js` | Abort/reload-safe browser draft delivery | ✓ VERIFIED | Real `answers` state reaches `/draft`; local storage is only a replay mirror. |
| API, decision, backend, and evidence docs | Honest operational contract and bounded evidence | ✓ VERIFIED | Current directory-lease, redaction, retention, and macOS-only boundaries are documented. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `RoundStore` | `writeFileAtomic` | `_write()` before `_records.set()` | ✓ WIRED | Failed writes yield `persistence_error` without publishing a new authoritative record. |
| `Bridge` | `RoundStore` | registration, draft, lifecycle, result, acknowledgement | ✓ WIRED | Mutations persist before their success paths continue. |
| Fresh store | fresh `Bridge` | recovery hydration and exact selector | ✓ WIRED | Restart/reconnect tests pass. |
| Browser `Flow` | `/draft` | `DraftWriter` → `postDraft()` | ✓ WIRED | Dynamic answer state, not a hardcoded projection, reaches the store. |
| Host adapters | explicit recovery selector | bridge client/MCP resume | ✓ WIRED | No selector-less latest-result route remains. |

### Data-Flow Trace

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `RoundStore` | `_records` | Validated `rounds/*.json` files | Yes | ✓ FLOWING |
| `Bridge` | `_pending.durable` | Created/hydrated store record | Yes | ✓ FLOWING |
| Browser `Flow` | `answers`, revision | React state → local mirror → `/draft` → `RoundStore` | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Focused Phase 9 suite | `node --test test/round-record.test.js test/round-store.test.js test/bridge.test.js test/server.test.js test/settings.test.js test/bridge-client.test.js test/mcp-long-round.test.js test/draft-writer.test.js test/live.test.js` | 160 passed, 0 failed | ✓ PASS |
| Full workspace suite | `npm test` | 440 passed, 0 failed | ✓ PASS |
| Queue A→B replay, PID reuse, contender safety, atomic faults | Named test pattern across `draft-writer.test.js` and `settings.test.js` | 8 passed, 0 failed | ✓ PASS |
| Diff integrity | `git diff --check e193fc7^ e193fc7` | exit 0 | ✓ PASS |
| macOS permission inspection | isolated store + `stat -f '%Lp'` | `rounds=700`, snapshot=`600`, temporary fixture removed | ✓ PASS |
| Lint/format | `npm run lint && npm run format:check` | `eslint: command not found` in this checkout | ⚠️ WARNING — local dev tooling is absent; not a Phase 9 implementation failure. |

### Probe Execution

No Phase 9 `scripts/**/tests/probe-*.sh` probe is declared or present.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
| --- | --- | --- | --- |
| DUR-01 | 09-01, 09-02 | ✓ SATISFIED | Server-owned v1 local snapshots are created before exposure and hydrate on restart. |
| DUR-02 | 09-01, 09-02 | ✓ SATISFIED | Revisioned `/draft`, queued replay, and restart coverage pass. |
| DUR-03 | 09-01, 09-02, 09-04 | ✓ SATISFIED | Atomic fault injection, leases, quarantine, retention cleanup, restart, and honest platform boundary pass. |
| DUR-04 | 09-03 | ✓ SATISFIED | Redacted discovery and exact selector enforcement pass. |
| DUR-05 | 09-02, 09-03 | ✓ SATISFIED | Immutable final result and idempotent result/ack paths pass across restart. |
| DUR-06 | 09-02, 09-03 | ✓ SATISFIED | Legacy registration retains its envelope and maps to its exact durable record. |

No Phase 9 requirement is orphaned. Nothing is deferred to Phase 10: later settings work does not remedy a Phase 9 durability obligation.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- |
| Phase 9 implementation files | — | No unreferenced `TBD`, `FIXME`, or `XXX` marker | ✓ | No auditable debt-marker blocker. |
| Local checkout | — | ESLint executable absent | ⚠️ Warning | Automated unit/integration suites run, but lint/format could not be independently executed here. |

### Disconfirmation Pass

- The former review’s A-in-flight/B-aborted loss is covered by a held A request, a queued B, rejection of B, reload at revision 1, and replay of B.
- The old file-lock test is not used as lease evidence: the deterministic directory-contender test proves the public pathname remains held until `rmdir`, and the recovering writer fails closed when a contender wins afterward.
- PID-reuse handling is deliberately conservative: only a mismatched Linux process-start identity proves death; unknown identity stays locked rather than risking concurrent writes.

## Gaps Summary

No implementation gaps found. The macOS permission inspection completed with `rounds=700` and snapshot=`600`; the result remains limited to macOS and makes no Linux, Windows, or universal power-loss claim. All 15 automated must-haves and DUR-01 through DUR-06 have current code, wiring, data-flow, and passing behavioral evidence.

---

_Verified: 2026-07-17T11:59:35Z_
_Verifier: the agent (gsd-verifier)_
