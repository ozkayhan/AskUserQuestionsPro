# Milestone Summary: v1.0.0

## Overview

AskUserQuestionsPro v1.0.0 hardens long-running local question rounds across Codex, Claude hook integration, the localhost bridge, browser UI, packaging, and documentation. The core result is bounded detach/resume behavior instead of losing a round when the host stream closes.

## Architecture

Host adapters use the shared bridge client. The localhost HTTP/SSE server coordinates one active round with stable request/round ownership. The browser owns typed transient answers and submits an opaque answer map. Detached rounds remain in memory for a bounded TTL and can be resumed by a fresh host process.

## Phases

1. Timeout diagnosis and redacted lifecycle observability.
2. Host lifecycle fix and typed fallback diagnostics.
3. Bridge/server ownership, cancellation, disconnect, and stale-round safety.
4. Browser state, SSE reconnect, error, and accessibility recovery.
5. CLI, installers, package boundaries, and release quality gates.
6. Maintained documentation and historical archive consolidation.
7. Cross-host integration acceptance and final handoff.

All 7 phases, 14 plans, and phase verification artifacts are complete.

## Decisions

- Preserve localhost-only, single-flight, Node 18+, and zero-runtime-dependency constraints.
- Diagnose timeout ownership before changing timeout constants.
- Treat host detach/resume as distinct from explicit cancellation and application timeout.
- Preserve historical rationale through provenance-aware documentation archives.

## Requirements

All 27 v1 requirements are mapped and complete across timeout/observability, host integrations, bridge reliability, browser behavior, quality, packaging, and documentation. Resumable hard-deadline tickets, remote multi-user sessions, and durable remote persistence remain v2 scope.

## Tech Debt

- A full authenticated Claude model-session acceptance run remains a manual follow-up.
- `STATE.md` has a stale performance metric showing 8 rather than 14 completed plans.
- Durable resumable tickets across hard host deadlines remain deferred to v2.

## Getting Started

Install Node.js 18+ dependencies with `npm ci`; run `npm test`, `npm run lint`, and `npm run format:check`. Read `docs/README.md` for maintained documentation and `docs/timeout-runbook.md` for long-round diagnosis and recovery.
