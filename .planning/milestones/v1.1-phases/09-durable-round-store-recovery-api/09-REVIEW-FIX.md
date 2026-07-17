---
phase: 09
fixed_at: 2026-07-17T11:51:58Z
review_path: .planning/phases/09-durable-round-store-recovery-api/09-REVIEW-FINAL.md
iteration: 3
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 09: Code Review Fix Report

**Fixed at:** 2026-07-17T11:51:58Z
**Source review:** `.planning/phases/09-durable-round-store-recovery-api/09-REVIEW-FINAL.md`
**Iteration:** 3

**Summary:**

- Findings in scope: 3
- Fixed: 3
- Skipped: 0

## Fixed Issues

### BL-01: A queued draft can be silently lost after the preceding edit succeeds

**Files modified:** `web/draft-writer.js`, `test/draft-writer.test.js`
**Commit:** e193fc7
**Applied fix:** Re-key queued browser drafts at the revision used for their request before removing their older mirror. A deterministic A-success/B-abort regression verifies B replays at revision 1 after reload and is cleared only after acknowledgement.

### WR-01: PID reuse makes a dead lease indistinguishable from a live owner

**Files modified:** `lib/atomic-write.cjs`, `test/settings.test.js`, `docs/backend.md`
**Commit:** e193fc7
**Applied fix:** Directory lease owners now persist Linux process start ticks. A live PID is reclaimed only when its identity differs; absent or unreadable identity fails closed. The mocked PID-reuse regression covers both paths.

### WR-02: Maintained backend documentation describes an obsolete lock protocol

**Files modified:** `docs/backend.md`
**Commit:** e193fc7
**Applied fix:** Documented `mkdir` directory-lease acquisition, private-owner recovery, atomic empty-directory retirement, PID-reuse handling, and fail-closed operational recovery.

---

_Fixed: 2026-07-17T11:51:58Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 3_
