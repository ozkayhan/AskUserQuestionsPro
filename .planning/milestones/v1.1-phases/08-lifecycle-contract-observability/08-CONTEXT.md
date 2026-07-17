# Phase 8: Lifecycle Contract & Observability - Context

**Gathered:** 2026-07-17
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous workflow; discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Users can keep a long-running round recoverable because its state, timeout owner, and terminal outcome are explicit rather than silently lost.

</domain>

<decisions>
## Implementation Decisions

The product must distinguish attachment loss from round cancellation. Avoidable application idle timeouts must not discard user work; unavoidable host deadlines must leave a resumable state. Lifecycle telemetry must be redacted and correlate boundaries without question or answer content. Preserve the localhost-only, Node 18+, zero-runtime-dependency architecture and existing round identity safeguards.

All implementation choices are at the agent's discretion within these constraints; autonomous discuss was skipped per project settings. Use the roadmap success criteria, research summary, existing v1.0 lifecycle decisions, and codebase conventions as the source of truth.

</decisions>

<code_context>
## Existing Code Insights

Inspect the existing bridge, bridge client, server, browser live transport, host adapters, lifecycle tests, and v1.0 research before planning. Phase 8 should define contracts and observability seams that Phase 9's durable store can implement without duplicating lifecycle policy.

</code_context>

<specifics>
## Specific Ideas

- Explicitly model drafting, detached, reconnecting, delivery-pending, delivered, delivery-uncertain, cancelled, recovery-error, and expired states.
- Include timeout owner and terminal reason in redacted diagnostics.
- Use deterministic clocks and race matrices for stale/duplicate/delayed operations.
- Research and plan live authenticated Claude Code/Codex verification, but do not claim host support from internal tests alone.

</specifics>

<deferred>
## Deferred Ideas

Durable on-disk round persistence belongs to Phase 9. Settings UI belongs to Phase 10. Browser recovery UX belongs to Phase 11. Adapter extraction and host expansion belong to Phases 12–13.

</deferred>
