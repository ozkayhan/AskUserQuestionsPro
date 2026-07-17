---
phase: 09-durable-round-store-recovery-api
reviewed: 2026-07-17T11:09:15Z
depth: deep
files_reviewed: 19
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
  - test/bridge.test.js
  - test/round-store.test.js
  - test/server.test.js
  - test/settings.test.js
  - web/app.js
  - web/live.js
findings:
  critical: 3
  warning: 0
  info: 0
  total: 3
status: issues_found
---

# Phase 09: Final Code Review Report

**Reviewed:** 2026-07-17T11:09:15Z
**Depth:** deep
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Commit `b71b920` fixes the original detached-round hydration case, exposes a
revision-guarded draft API, rejects selector-less resume, schedules expiry
cleanup, tightens existing store directories, and narrows the durability
evidence. The focused suites pass, but three recovery/durability guarantees
remain false under ordinary interruption or concurrent-writer races.

Verified fixed from the prior review: detached-state restart hydration; direct
draft API persistence and reload; explicit selectors/no latest-result fallback;
startup plus periodic expiry deletion; existing-directory `0700` tightening;
and the evidence's removal of unimplemented filesystem-fault claims. These do
not close the findings below.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: A resumed round becomes unrecoverable after a subsequent bridge restart

**File:** `server/bridge.js:84`, `server/bridge.js:301-304`

**Issue:** `_hydrate()` sets `p.detached` only when the persisted lifecycle is
`detached`. `waitForAnswers()` persists the lifecycle as `reconnecting`, but
leaves the live `p.detached` flag true. If the bridge restarts while that
resumed waiter is still awaiting the browser, hydration restores the record as
`reconnecting` with `p.detached === false`; `_findDetached()` then rejects the
same explicit selector with `stale_round`. A direct reproduction produced
`{"diskState":"reconnecting","hydratedState":"reconnecting","detached":false,"retry":"stale_round"}`.
This loses the phase's restart recovery path precisely during a host retry.

**Fix:** Treat every nonterminal recoverable lifecycle (`drafting`, `detached`,
and `reconnecting`) as browser-owned/resumable after hydration, or make
`_findDetached()` consult the durable lifecycle rather than the transient flag.
Add a regression that detaches, begins an explicit resume, restarts the bridge,
then resumes and answers the same round.

### CR-02: The browser discards the most recent draft edit on refresh or close

**File:** `web/app.js:77-88`

**Issue:** Each answer change is persisted only after a 250 ms timer. The effect
cleanup clears that timer on unmount, so refreshing, closing, or crashing the
browser during the debounce interval sends no `/draft` request at all. This is
not a theoretical network failure: a user can select an answer and immediately
reload, and the durable record retains the previous draft. The stated recovery
contract requires meaningful edits to survive browser interruption/restart.

**Fix:** Persist the material edit before allowing it to be lost (for example,
write immediately and coalesce only subsequent in-flight updates), and add a UI
or integration regression that edits then immediately unmounts/reloads and
observes the edit after hydration. If a debounce is retained, flush it with a
delivery mechanism that has a defined unload guarantee and keep the normal
revision-conflict path intact.

### CR-03: Stale-lock takeover can still delete a newly acquired writer's lock

**File:** `lib/atomic-write.cjs:41-50`

**Issue:** The second token read is only a check; it is not atomically coupled
to `unlinkSync()`. After the equality check at line 47, another writer can
remove the dead lock and create its own fresh lock. This contender then unlinks
that fresh lock at line 49 and acquires the pathname, while the displaced writer
continues writing under its now-unlinked lock. Concurrent atomic renames can
therefore still overwrite a newer lifecycle/revision snapshot. The added test
covers old/live owners but not this stale-takeover interleaving.

**Fix:** Do not implement lock stealing as check-then-unlink. Use an ownership
safe lock primitive/protocol (such as an atomic rename-based lease with a unique
owner file and verified inode/owner handoff), or fail closed and require manual
stale-lock recovery. Add a deterministic two-contender test that swaps the lock
between verification and removal and proves the new owner is never removed.

---

_Reviewed: 2026-07-17T11:09:15Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_

## Verification Performed

- Passed: `node --test test/round-record.test.js test/round-store.test.js test/bridge.test.js test/server.test.js test/settings.test.js test/bridge-client.test.js test/mcp-long-round.test.js` — 140 passed, 0 failed.
- Reproduced CR-01 with a detached round that entered `reconnecting`, then a fresh `Bridge`/`RoundStore` restart.
- `npm run lint -- --quiet` and `npm run format:check -- --check` could not run because the workspace has no installed `eslint` or `prettier` executable (`sh: command not found`).
