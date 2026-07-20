---
status: testing
phase: 19-browser-lifecycle-recovery-corrections
source: 19-01-SUMMARY.md, 19-02-SUMMARY.md, 19-03-SUMMARY.md
started: 2026-07-20T15:42:00Z
updated: 2026-07-20T15:42:00Z
---

## Current Test

number: 1
name: Normal acknowledged round closes its owning tab
expected: |
  Complete and acknowledge a round. The tab attempts to close only after acknowledgement and does not render a later round.
awaiting: user response

## Tests

### 1. Normal acknowledged round closes its owning tab
expected: Complete and acknowledge a round; close happens only after acknowledgement and the retired tab ignores later rounds.
result: [pending]

### 2. Repeated rounds do not duplicate a completed tab
expected: Open a second host round after the first completes; only the new owning tab renders the second round.
result: [pending]

### 3. Normal delivery stays free of recovery prompts
expected: Normal submission and ordinary SSE reconnect show no recovery chooser, warning, toast, or technical status.
result: [pending]

### 4. Interrupted or detached round opens recovery
expected: A disconnected requestId-bearing round appears with the exact retained round available to continue, delete, or leave while starting a new round.
result: [pending]

### 5. Submit/acknowledgement ordering is quiet
expected: After submit, the tab is retired and only quiet “Sending answers…” appears until acknowledgement; no success/recovery panel appears.
result: [pending]

### 6. Denied close and explicit never remain passive
expected: Close-denied and closure.mode=never leave quiet completion copy with no retry/recovery/new-round action, and later rounds are ignored.
result: [pending]

### 7. Retired callbacks and reconnect timers are ignored
expected: Old EventSource callbacks and reconnect timers after retirement do not remount the round, clear state, reopen recovery, or loop.
result: [pending]

### 8. Recovery discovery states render correctly
expected: Loading/error show a chooser without actions, populated shows redacted records and actions, and empty suppresses the chooser.
result: [pending]

### 9. Reconnect and uncertainty route differently
expected: Ordinary reconnect remains silent; answer/ack uncertainty opens the distinct “We couldn't confirm delivery.” recovery flow without closing.
result: [pending]

### 10. Recovery actions preserve exact identity and failure state
expected: Continue is deferred, Delete asks for confirmation, Start a new round retains saved data, and failed actions preserve chooser selection.
result: [pending]

### 11. Browser visual and accessibility matrix
expected: At narrow width and across AMOLED, Paper, Phosphor, Dusk, Aurora, high contrast, and reduced motion, focus/ARIA, 44px controls, wrapping, legibility, and motion suppression hold without payload disclosure.
result: [pending]

### 12. Full localhost/host boundary procedure
expected: Run the documented localhost server plus configured host path and confirm the lifecycle/recovery outcomes above with real browser and host evidence.
result: [pending]

## Summary

total: 12
passed: 0
issues: 0
pending: 12
skipped: 0
blocked: 0

## Gaps

