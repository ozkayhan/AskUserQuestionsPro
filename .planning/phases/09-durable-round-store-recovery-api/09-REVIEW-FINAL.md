---
phase: 09-durable-round-store-recovery-api
reviewed: 2026-07-17T11:46:49Z
depth: deep
files_reviewed: 26
files_reviewed_list:
  - docs/api.md
  - docs/backend.md
  - docs/decisions.md
  - docs/evidence/phase-09-durable-recovery.md
  - docs/timeout-runbook.md
  - lib/atomic-write.cjs
  - lib/bridge-client.mjs
  - lib/round-record.cjs
  - lib/round-store.cjs
  - mcp-server/askuserquestionspro-mcp.mjs
  - server/bridge.js
  - server/server.js
  - skill/askpro/SKILL.md
  - test/bridge-client.test.js
  - test/bridge.test.js
  - test/draft-writer.test.js
  - test/live.test.js
  - test/mcp-long-round.test.js
  - test/round-record.test.js
  - test/round-store.test.js
  - test/server.test.js
  - test/settings.test.js
  - web/app.js
  - web/draft-writer.js
  - web/index.html
  - web/live.js
findings:
  critical: 1
  warning: 2
  info: 0
  total: 3
status: issues_found
---

# Phase 09: Final Code Review Report

**Reviewed:** 2026-07-17T11:46:49Z
**Depth:** deep
**Files Reviewed:** 26
**Status:** issues_found

## Summary

The `0325d4e` directory-lease replacement closes the prior public-lock unlink
race: the deterministic contender test now exercises the critical `rmdir`
handoff, and a newly acquired lease remains intact. However, the durable draft
replay protocol still loses a newer edit during a normal in-flight-edit
interleaving. The report therefore cannot be marked `passed`.

The review also found a PID-reuse availability hole in dead-owner detection and
one maintained document that still describes the removed age-based lockfile
protocol. No production files were modified during review.

## Narrative Findings (AI reviewer)

## Blockers

### BL-01: A queued draft can be silently lost after the preceding edit succeeds

**File:** `web/draft-writer.js:64-89`

**Issue:** `write()` stores every new edit under the revision that is current at
the instant of the UI event. If edit A is in flight at revision 0 and the user
makes edit B, B replaces the local `revision 0` mirror and is queued. After A
succeeds, `drain()` correctly sends B at revision 1, but never moves B's mirror
to the `revision 1` key. If B's request is then rejected/aborted, a reload sees
the server's revision 1 and calls `readPendingDraft(..., 1)`, while B exists
only under revision 0; it is ignored and lost.

Direct deterministic reproduction produced:

```json
{"revision":1,"revision0":{"answer":"second"},"revision1":null}
```

This violates DUR-02's incremental-edit recovery guarantee. The existing tests
cover a single aborted edit and sequential successful edits, but not this
two-edit interleaving.

**Fix:** Associate each queued payload with the revision at which it will be
sent. When a prior request advances the revision, persist the queued payload at
that next expected-revision key before issuing its request (and remove only the
matching older key). Add a deterministic regression: hold A's save promise,
queue B, resolve A, reject B, recreate the writer at revision 1, and assert B
is replayed.

## Warnings

### WR-01: PID reuse makes a dead lease indistinguishable from a live owner

**File:** `lib/atomic-write.cjs:12-21, 76`

**Issue:** Dead-owner recovery treats a successful `process.kill(pid, 0)` as
proof that the lease owner is live. PIDs can be reused after the writer crashes;
an unrelated process with the reused PID makes the stale lease fail closed
until that unrelated process exits. The random token is not tied to an OS
process identity, so it cannot disambiguate this case. This preserves safety
but can leave all durable writes unavailable indefinitely, contrary to the
documented dead-owner recovery contract.

**Fix:** Persist and verify an OS process-identity value in addition to the PID
(for example, a platform-supported process start identity), and test a mocked
PID-reuse case. If a portable identity cannot be verified, document the
fail-closed operational recovery path rather than calling the owner
"confirmed-dead."

### WR-02: Maintained backend documentation describes an obsolete lock protocol

**File:** `docs/backend.md:164-179`

**Issue:** The document still says writes use an `O_EXCL` lockfile and reclaim
locks older than ten seconds. Current code uses a `mkdir` directory lease with
an `owner` entry and only recovers a dead owner. This contradicts
`lib/atomic-write.cjs` and the current durability decision/evidence, and could
lead maintainers to reintroduce unsafe age-based reclamation.

**Fix:** Replace the lockfile/10-second description with the current
directory-lease acquisition, live/uncertain fail-closed behavior, and atomic
empty-directory retirement semantics. Keep the durability boundary explicit.

## Verification Performed

- Read prior Phase 09 reviews, final-fix report, verification report, plans,
  summaries, API/decision/evidence documents, and all 26 Phase 09 changed
  source files at `0325d4e`.
- Traced durable record/store mutations through bridge/server recovery and the
  browser draft writer; inspected dead/live/stale directory-lease behavior and
  the deterministic contender test.
- Passed: `node --test test/settings.test.js test/round-record.test.js test/round-store.test.js test/bridge.test.js test/server.test.js test/draft-writer.test.js test/live.test.js test/bridge-client.test.js test/mcp-long-round.test.js` — **158 passed, 0 failed**.
- Passed: `git diff --check 8ab0ac5..0325d4e`.
- Independently reproduced BL-01 with a held first save, a queued second edit,
  and a rejected second transport; the replay mirror remained at revision 0
  after the authoritative revision advanced to 1.

---

_Reviewed: 2026-07-17T11:46:49Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
