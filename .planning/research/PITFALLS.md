# Reliability and Documentation Pitfalls

**Date:** 2026-07-16

## Technical Pitfalls

| Pitfall                                                   | Early warning                                                             | Prevention                                                                                    | Phase            |
| --------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------- |
| Treating the one-hour app timeout as the root cause       | Constants increase but Codex still closes at the same wall-clock boundary | Capture host disconnect/cancel/close timestamps and reproduce at multiple idle durations      | Diagnosis        |
| Canceling a newer round after an old `/ask` socket closes | Intermittent wrong-round cancellation or 409s                             | Require both request/round ownership on every cancel and test delayed close events            | Bridge hardening |
| Sending unsupported MCP keepalives                        | Host logs protocol errors or terminates the server                        | Confirm protocol/client support, gate behavior, and test raw JSON-RPC interoperability        | Host fix         |
| Solving a hard host deadline by hiding errors             | Browser closes with no user-visible reason and no trace                   | Separate host failure, bridge cancellation, and user cancellation in diagnostics and fallback | Host fix         |
| Introducing resumable state without a lifecycle owner     | Orphaned rounds survive forever or answers attach to the wrong call       | Define ticket expiry, ownership, cleanup, and replay semantics before implementation          | Architecture     |
| Refactoring CommonJS/ESM boundaries casually              | CLI/MCP works on one Node version but fails on another                    | Keep module boundaries explicit and run the full Node 18 matrix                               | Cross-cutting    |
| Testing only pure helpers                                 | Unit suite passes while real browser/host connection still dies           | Retain wire-level and manual host tests with long idle windows                                | Verification     |

## Documentation Taxonomy

### Maintained reference set

- `docs/README.md`: index and audience guide.
- `docs/overview.md`: product behavior and host choice.
- `docs/architecture.md`: components, data flow, invariants, and decisions.
- `docs/api.md`: HTTP/MCP/hook contracts.
- `docs/backend.md`: Node implementation details and operational lifecycle.
- `docs/frontend.md`: browser state, interaction, accessibility, and SSE.
- `docs/testing.md`: test layout, isolation, wire tests, and manual verification.
- `docs/tech-stack.md`: runtime, packaging, dependencies, and CI.
- A new troubleshooting/runbook document should own timeout diagnostics and recovery once behavior is known.

### Historical evidence

- `docs/old/audit-report.md` is a large findings source and should be mined for still-open issues, not deleted wholesale.
- `docs/old/planv2.md` and `docs/old/plan-dynamic-hardening-workflow-for-askuserquestio.md` contain overlapping architecture/contract decisions; consolidate their durable content.
- The two dynamic workflow documents and `docs/old/hardening-workflow.js` describe process mechanics rather than product truth; archive or remove after extracting any still-used validation ideas.
- `docs/old/todos.md` is empty and is a safe deletion candidate unless git history itself is required for audit purposes.

## Cleanup Rules

1. Verify every technical claim in a document against source/tests before retaining it as current.
2. Move durable decisions and unresolved findings into maintained docs or planning artifacts with source links.
3. Keep historical originals only when they add provenance or unresolved context; otherwise delete exact duplicates.
4. Use stable, descriptive names and one index; eliminate filename truncation and dead links.
5. Never delete an old document before recording its extracted decisions/findings and checking inbound references.
6. Finish with a link/path scan and a factual doc verification pass.
