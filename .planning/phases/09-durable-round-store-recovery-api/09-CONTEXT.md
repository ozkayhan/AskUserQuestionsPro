# Phase 9: Durable Round Store & Recovery API — Context

## Phase Boundary

Make the Node bridge authoritative across browser refresh, host detachment, bridge restart, partial writes, and repeated result retrieval. This phase owns the durable round record and recovery API; settings v2 and browser presentation remain in later phases.

## Implementation Decisions

- Persist one crash-safe record per round under the existing local configuration/runtime area, with restrictive permissions and atomic temp-write/rename semantics.
- Treat the server record as authoritative. Browser storage may mirror drafts but must never replace or contradict the server record after reconnect.
- Use explicit round IDs and request IDs for selection; never guess a “latest” round when more than one recoverable record exists.
- Make submitted answers and delivery acknowledgements immutable and idempotent. Retries must return the same result or a typed recovery error.
- Preserve legacy in-memory/HTTP request behavior by migrating an active pre-v1.1 round into the durable model at registration time.
- Quarantine corrupt records individually so one bad file cannot hide healthy recoverable rounds.

## Verification Focus

- Injected crash/partial-write scenarios and restrictive-permission checks.
- Restart/reload recovery with exact question and answer revisions.
- Explicit round selection, idempotent result retrieval, and duplicate acknowledgement.
- Retention/expiry behavior and cleanup without deleting unrelated rounds.
- Automated regression coverage plus a documented macOS validation path; do not claim Linux/Windows execution from this macOS workspace.

