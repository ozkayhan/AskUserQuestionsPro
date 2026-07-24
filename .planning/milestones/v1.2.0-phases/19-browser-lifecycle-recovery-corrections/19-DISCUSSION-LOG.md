# Phase 19: Browser Lifecycle and Recovery Corrections - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-19
**Phase:** 19-browser-lifecycle-recovery-corrections
**Areas discussed:** Tab lifecycle, Recovery UX, Copy and information hierarchy

> AskUserQuestionsPro was requested for grouped questions. The bridge had two stale pending rounds and the browser connection failed while opening/resuming the grouped set, so the same grouped questions were answered through the chat fallback. The stale rounds were explicitly cancelled before continuing.

## Tab lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Every successful delivery closes automatically | Close after successful acknowledgement without preserving the setting | |
| Preserve setting, default to close | Keep the existing closure preference but make after-delivery the default | ✓ |
| Quiet passive state after close denial | If the browser rejects close, leave the old tab passive and stop future round updates | ✓ |
| Retire after acknowledgement | Old tab stops listening only after acknowledgement | |
| Retire after submit | Old tab stops listening as soon as submit begins | ✓ |
| Retire at both points | Submit-time guard plus acknowledgement-time terminal close | |

**User's choice:** Preserve the setting with automatic close as default; retire at submit; if close is denied, remain quiet and passive.
**Notes:** The tab must not render a later round even when physical closure is denied.

## Recovery UX

| Option | Description | Selected |
|--------|-------------|----------|
| Hide delivered terminal rounds | Delivered records never appear in recovery | ✓ |
| Show only uncertain delivery | Keep delivery-uncertain records recoverable | Implied by the interruption/uncertain choice |
| Show on host/browser interruption | Detached/reconnecting rounds that can continue | ✓ |
| Show on uncertain delivery | Preserve the safe retry/recovery path | ✓ |
| Show only when user asks | No automatic recovery prompt | |
| Show on every reconnect | Treat ordinary SSE reconnect as recovery | |
| No UI after normal success | Close directly after successful delivery | ✓ |
| Continue exact round | Preserve the existing round identity and answers | ✓ |
| Delete/cancel retained round | Let the user discard a recoverable round | ✓ |
| Start new round | Let the user leave the old round and begin cleanly | ✓ |

**User's choice:** Recovery is state-driven: interruption or uncertain delivery only; normal success shows nothing and closes directly. Recovery offers continue, cancel/delete, and new round.

## Copy and information hierarchy

| Option | Description | Selected |
|--------|-------------|----------|
| Human language only | No technical state terminology | |
| Simple copy with small state detail | Human-language heading and explanation, technical detail in small secondary text | ✓ |
| Technical-first copy | State, round id, and server details are prominent | |

**User's choice:** Sade mesaj başlığı; teknik ayrıntı küçük fontla.

## the agent's Discretion

- Exact copy, typography, and placement of secondary technical detail.
- Whether “new round” is a separate button or equivalent explicit start path.
- Internal implementation of submit-time retirement and acknowledgement-time close, subject to the locked behavior.

## Deferred Ideas

None.
