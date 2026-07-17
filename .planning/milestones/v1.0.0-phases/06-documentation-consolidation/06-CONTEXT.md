# Phase 6 Context: Documentation Consolidation

## Objective

Turn the scattered documentation into one code-verified reference set, extract
durable architecture decisions from the historical audit/plan material, and
remove ambiguity caused by duplicate or empty documents.

## Locked decisions

- Maintained docs live directly under `docs/` and are indexed by `docs/README.md`.
- Historical non-empty material is retained under `docs/archive/` with descriptive
  names and an explicit disposition table.
- Empty documents and exact duplicates may be deleted after their status is
  recorded in the archive README.
- The timeout runbook must distinguish application behavior from unknown host
  deadlines and must not claim live Codex/Claude proof before Phase 7.
- Relative links in all `docs/**/*.md` files must resolve; a node:test regression
  test owns this invariant.

## Source evidence

- `docs/old/audit-report.md` contained 195 findings and five systemic themes.
- `docs/old/planv2.md` and the dynamic hardening plan contained Contracts R/W/L/T,
  bundle ownership, verification architecture, and the do-not-touch rule.
- The two dynamic workflow specs and JS workflow are process artifacts, not current
  product truth.
- `docs/old/todos.md` was empty; root `planv2.md` duplicated the plan exactly.

## Verification contract

Documentation is complete when the maintained index, architecture/API/backend/
frontend/testing/host/timeout references agree with source, archived material has
provenance, no dead docs links or legacy directory remain, and all project gates
still pass.
