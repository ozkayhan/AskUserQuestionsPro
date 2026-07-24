---
status: blocked
phase: 19-browser-lifecycle-recovery-corrections
source: 19-01-SUMMARY.md, 19-02-SUMMARY.md, 19-03-SUMMARY.md
started: 2026-07-20T15:42:00Z
updated: 2026-07-24T19:24:00+03:00
---

## Current Test

number: 4
name: Interrupted or detached round opens recovery
expected: |
  A disconnected requestId-bearing round appears with the exact retained round available to continue, delete, or leave while starting a new round.
result: blocked
blocked_by: external-browser-host
reason: "Automated localhost/browser coverage continued below; remaining checks require the configured host connector or full visual/AT environment."

## Tests

### 1. Normal acknowledged round closes its owning tab
expected: Complete and acknowledge a round; close happens only after acknowledgement and the retired tab ignores later rounds.
result: pass
evidence: "Localhost browser smoke completed a two-question round, observed POST /answer 200 and /rounds/:roundId/ack 200, and rendered only the passive This round is complete state."

### 2. Repeated rounds do not duplicate a completed tab
expected: Open a second host round after the first completes; only the new owning tab renders the second round.
result: pass
evidence: "After round 1 completed, round 2 was opened; the retired first tab remained on This round is complete while a new tab rendered the second round."

### 3. Normal delivery stays free of recovery prompts
expected: Normal submission and ordinary SSE reconnect show no recovery chooser, warning, toast, or technical status.
result: pass
evidence: "The completed localhost round showed no recovery chooser or Saved round changed surface; browser console contained only the expected Babel development warning."

### 4. Interrupted or detached round opens recovery
expected: A disconnected requestId-bearing round appears with the exact retained round available to continue, delete, or leave while starting a new round.
result: blocked
blocked_by: external-browser-host
reason: "The exact configured host/browser interruption and recovery chooser flow was not available in this run. Bridge/server source and integration contracts pass."

### 5. Submit/acknowledgement ordering is quiet
expected: After submit, the tab is retired and only quiet “Sending answers…” appears until acknowledgement; no success/recovery panel appears.
result: pass
evidence: "Browser request trace showed draft saves, answer delivery, and acknowledgement in order; no success/recovery panel appeared before the final passive completion state."

### 6. Denied close and explicit never remain passive
expected: Close-denied and closure.mode=never leave quiet completion copy with no retry/recovery/new-round action, and later rounds are ignored.
result: blocked
blocked_by: external-browser-host
reason: "The runtime close-denied and closure.mode=never matrix needs a dedicated browser configuration run; source ordering and gate tests pass."

### 7. Retired callbacks and reconnect timers are ignored
expected: Old EventSource callbacks and reconnect timers after retirement do not remount the round, clear state, reopen recovery, or loop.
result: pass
evidence: "The retired first tab did not render the subsequently opened second round; the pure round acceptance-gate regression also passes."

### 8. Recovery discovery states render correctly
expected: Loading/error show a chooser without actions, populated shows redacted records and actions, and empty suppresses the chooser.
result: blocked
blocked_by: external-browser-host
reason: "Mounted recovery discovery state transitions were not exercised against the configured host/recovery boundary; source contracts pass."

### 9. Reconnect and uncertainty route differently
expected: Ordinary reconnect remains silent; answer/ack uncertainty opens the distinct “We couldn't confirm delivery.” recovery flow without closing.
result: blocked
blocked_by: external-browser-host
reason: "Network interruption and acknowledgement uncertainty need a controlled browser/host runtime lane; pure transition and source tests pass."

### 10. Recovery actions preserve exact identity and failure state
expected: Continue is deferred, Delete asks for confirmation, Start a new round retains saved data, and failed actions preserve chooser selection.
result: blocked
blocked_by: external-browser-host
reason: "The real chooser action/failure sequence requires a recoverable host round; exact identity and action contracts are covered by automated tests."

### 11. Browser visual and accessibility matrix
expected: At narrow width and across AMOLED, Paper, Phosphor, Dusk, Aurora, high contrast, and reduced motion, focus/ARIA, 44px controls, wrapping, legibility, and motion suppression hold without payload disclosure.
result: blocked
blocked_by: external-browser-host
reason: "A 390x844 localhost smoke had no horizontal overflow and option controls were at least 62px high, but all themes, high contrast, reduced motion, and assistive-technology lanes still require the full manual matrix."

### 12. Full localhost/host boundary procedure
expected: Run the documented localhost server plus configured host path and confirm the lifecycle/recovery outcomes above with real browser and host evidence.
result: blocked
blocked_by: external-browser-host
reason: "Localhost plus Playwright CLI was available, but the configured Claude/Codex host connector and authenticated end-to-end boundary were not."

## Summary

total: 12
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 7

## Gaps

None — remaining items are external/browser-host verification gates, not implementation gaps.
