---
phase: 09-durable-round-store-recovery-api
reviewed: 2026-07-17T00:00:00Z
depth: deep
files_reviewed: 16
files_reviewed_list:
  - docs/api.md
  - docs/decisions.md
  - docs/evidence/phase-09-durable-recovery.md
  - lib/atomic-write.cjs
  - lib/bridge-client.mjs
  - lib/round-record.cjs
  - lib/round-store.cjs
  - mcp-server/askuserquestionspro-mcp.mjs
  - server/bridge.js
  - server/server.js
  - test/bridge-client.test.js
  - test/bridge.test.js
  - test/mcp-long-round.test.js
  - test/round-record.test.js
  - test/round-store.test.js
  - test/server.test.js
findings:
  critical: 3
  warning: 3
  info: 0
  total: 6
status: issues_found
---

# Phase 09: Code Review Report

**Reviewed:** 2026-07-17T00:00:00Z
**Depth:** deep
**Files Reviewed:** 16
**Status:** issues_found

## Summary

The durable record and store primitives are implemented, but the bridge does not
hydrate an unfinished durable record after restart, draft edits never reach the
store, and expired snapshots are never cleaned up. These break the phase's core
recovery, revision, and retention guarantees. Full tests pass, but they do not
exercise the failed restart path.

## Narrative Findings (AI reviewer)

## Blockers

### BL-01: Restarted bridge cannot recover an unfinished round

**File:** `server/bridge.js:60`, `server/bridge.js:200-225`, `server/server.js:16-21`

**Issue:** The server creates a fresh `RoundStore` at startup, which loads disk
records, but `Bridge` only stores that object and never hydrates a durable
draft/detached record into `_pending`. `waitForAnswers()` can only find a
live in-memory detached round or a record that already has final answers. A
restart between host detachment and browser submission therefore makes the
record discoverable in `GET /rounds`, while `/current` is empty and
`POST /resume` fails with `stale_round`. Direct verification reproduced this
with a persisted detached record.

**Fix:** During bridge construction, enumerate unexpired durable records in
recoverable nonterminal states, require explicit/unique selection where needed,
and reconstruct the active pending round (questions, capability, lifecycle,
request ID, expiry timer, and durable ID). Add an integration test that starts a
server, detaches a round, restarts the server, then resumes and answers the same
round.

### BL-02: Draft-answer persistence is entirely disconnected from the runtime

**File:** `lib/round-record.cjs:60-65`, `server/bridge.js:156-176`, `server/server.js:422-446`

**Issue:** `saveDraft()` is the only transition that writes
`draftAnswers` and advances a draft revision, but it has no production caller.
The only answer path calls `finalize()` when the user submits the complete
form. Consequently no meaningful answer edit is persisted, and browser refresh
or bridge restart before final submission loses all draft answers, contrary to
the durable-round contract.

**Fix:** Add a capability- and revision-guarded draft endpoint (or wire the
existing edit path through a bridge `saveDraft` method), persist each accepted
material change before responding, and make hydration expose the persisted draft
to the recovery UI. Cover revision conflicts, idempotent identical saves, and a
restart after a draft save.

### BL-03: Retention is only a visibility filter; expired answer files remain forever

**File:** `lib/round-store.cjs:43-45`, `server/server.js:16-21`

**Issue:** `list()` hides records after `expiresAt`, but the only code that
removes their files is `cleanupExpired()`, which has no production call site
or timer. Expired snapshots—including question text, answers, and capability—
therefore remain in the configuration directory indefinitely. Direct
verification showed `listed: 0` while the expired `.json` file was still on
disk.

**Fix:** Invoke cleanup at store startup and on a bounded periodic schedule (and
before/after relevant lifecycle operations), retaining failed deletions for
retry. Add a server-level test proving expiry removes only the target snapshot
without deleting healthy or quarantine siblings.

## Warnings

### WR-01: Existing store directories are not made private

**File:** `lib/round-store.cjs:20`

**Issue:** `mkdirSync(..., { mode: 0o700 })` applies the mode only when it
creates a directory; it does not tighten an existing `rounds/` or
`quarantine/` directory. On a reused configuration root with permissive modes
or inherited ACLs, the implementation violates its claimed private-directory
guarantee and may expose round filenames or quarantined content to other local
users.

**Fix:** After ensuring each directory, inspect and explicitly `chmodSync`
new/existing directories to `0o700` (with a platform-aware ACL policy), and
test a pre-existing permissive directory.

### WR-02: Atomic-write stale-lock takeover can permit concurrent lost updates

**File:** `lib/atomic-write.cjs:11-35`, `lib/atomic-write.cjs:50-59`

**Issue:** A writer that legitimately takes more than ten seconds is treated as
dead. A second process can unlink its lock, write and rename its own temp file,
then the first writer later renames over that newer snapshot. This defeats the
lock's stated single-writer guarantee and can lose a later lifecycle/revision
update under I/O stalls or concurrent server instances.

**Fix:** Do not reclaim a lock solely by age. Store owner identity and verify it
is dead before recovery, or use a lock primitive with ownership-safe renewal;
at minimum use an owner token and only unlink the lock if it still contains the
token observed during stale detection. Add a two-writer slow-write regression.

### WR-03: Maintained documentation and evidence overstate or contradict the implementation

**File:** `docs/decisions.md:12-18`, `docs/evidence/phase-09-durable-recovery.md:26-30`

**Issue:** D-001 still says question/answer payloads are not persisted, which is
now false. The Phase 09 evidence also claims tests cover injected write/sync/
close/rename/lock/directory-creation failures, but the Phase 09 store tests
only cover normal write/reload, corrupt JSON quarantine, and a direct manual
`cleanupExpired()` call. This leaves reviewers with an incorrect security and
reliability record.

**Fix:** Update D-001 to defer to D-010 for durable-round persistence, and
either add the claimed fault-injection tests or narrow the evidence to the
coverage that actually exists.

---

_Reviewed: 2026-07-17T00:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
