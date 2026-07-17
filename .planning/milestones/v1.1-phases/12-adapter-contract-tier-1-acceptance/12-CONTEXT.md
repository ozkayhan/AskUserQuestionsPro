# Phase 12: Adapter Contract & Tier 1 Acceptance — Context

**Gathered:** 2026-07-17  
**Status:** Ready for planning  
**Mode:** Autonomous conservative product-manager defaults (user unavailable)

## Domain

This phase proves that the existing Claude Code hook path and Codex MCP/stdio
path are distinct lifecycle adapters over the Phase 8–11 bridge contract. It
also makes installation and support claims evidence-backed without requiring
an authenticated external host to be present in the planning environment.

## Decisions

### D-01 — Separate adapter identities and public contract

Define one host-neutral adapter contract for start, attach, detach, cancel,
resume, status, result, and delivery acknowledgement, then implement/verify
Claude Code and Codex as separate adapters. Shared bridge helpers may be reused,
but host framing, timeout ownership, cancellation, fallback, and response
serialization must remain explicit per adapter. The contract must preserve
Node.js 18+, zero production dependencies, and loopback-only operation.

### D-02 — Capability cards are the source of support claims

Create maintained capability cards for Claude Code and Codex containing version
and evidence date, transport, timeout/deadline owner, cancellation semantics,
approval/trust behavior, configuration scope, install/upgrade/uninstall surface,
tested scenarios, limitations, and evidence state. Unknown live values are
marked unavailable/researching; they are never guessed from protocol shape.

### D-03 — Fake-host conformance precedes live-host promotion

Build a deterministic fake-host harness that drives each adapter through start,
attach, detach, cancel, resume, status, result, and acknowledgement, including
duplicate and stale operations. A host is not considered usable by automated
evidence until this conformance suite passes. Use subprocess/stdin/stdout and
temporary home/config directories to test real framing and installer behavior.

### D-04 — Host-specific fallback and cancellation are non-negotiable

Claude hook failures continue to exit successfully with native picker fallback;
Codex MCP cancellation and stdin disconnect remain distinct, with disconnect
detaching for explicit resume and cancellation remaining terminal. Progress,
timeouts, opaque identifiers, and immutable/idempotent results must be asserted
without logging question or answer content.

### D-05 — Install operations are scoped and repeatable

Install, doctor, upgrade/reinstall, and uninstall tests run in isolated fake
home/config environments and prove target-specific mutation: Claude changes
Claude settings/hook only, Codex changes Codex MCP config only, shared runtime
is retained while another adapter remains, and repeated operations are safe.
No authenticated host or coding tool installation is attempted.

### D-06 — Evidence state is honest and dated

Record automated evidence now and provide exact commands/procedures for
version-pinned authenticated Claude Code and Codex runs covering idle,
reconnect, restart, cancellation, recovery, and delivery. Because authenticated
external hosts are unavailable in this environment, live acceptance remains
explicitly `Researching`/`Unavailable` until those commands are run; the plan
must not convert fake-host evidence into a live support claim.

## Discretion

- Use Markdown capability cards and a machine-readable JSON evidence fixture only
  if it can be maintained without introducing a runtime dependency; keep the
  public compatibility matrix owned by Phase 13.
- Prefer existing `node:test`, child-process, isolation helpers, shell scripts,
  and current MCP/Hook test seams.
- Use synthetic question/answer content in tests and assert redaction at logs,
  diagnostics, and evidence artifacts.

## Deferred / Out of Scope

- Evaluating or promoting hosts beyond Claude Code and Codex (Phase 13).
- Authenticated live host execution in this unavailable environment; the plans
  must prepare and document it, not fabricate its result.
- Installing other coding tools, external packages, or changing the production
  dependency/distribution model.

## Existing Contracts to Preserve

- Phase 9 explicit round selection, opaque capability checks, immutable result,
  and idempotent acknowledgement.
- Phase 10 adapter enablement and redacted settings/doctor projection.
- Phase 11 acknowledgement-gated closure and recovery UX.
- Current Claude `PreToolUse` fallback and Codex MCP `ask`/`resume` semantics.
