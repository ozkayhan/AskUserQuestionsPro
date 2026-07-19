---
phase: 14-static-quality-reproducibility
status: planned
---

# Phase 14 Nyquist validation map

| Requirement | Plan/task | Automated validation | Evidence artifact / expected result |
|---|---|---|---|
| QUAL-01 | 14-01 tasks 1–2 | `node --test test/bridge-client.test.js test/server.test.js test/runtime-settings.test.js test/browser-settings-cli-e2e.js test/browser-settings-e2e.test.js test/host-evidence-matrix.test.js` and `npm run lint` | Zero lint errors; no-unused-vars, no-empty, no-undef, and no-useless-escape remain enabled; focused suites preserve behavior. |
| QUAL-02 | 14-02 task 1 | `node --test test/eslint-prettier-config.test.js` and `npm run format:check` | Scope assertions prove maintained runtime/browser/test/docs/root coverage, vendor/archive/generated exclusions, and explicit `.github/` non-Prettier ownership. |
| QUAL-03 | 14-02 task 2 | `npm ci && npm test && npm run lint && npm run format:check && npm audit --omit=dev --audit-level=high && npm pack --dry-run --json` | `.planning/phases/14-static-quality-reproducibility/14-QUAL-03-EVIDENCE.md` records local Node/npm versions, all command statuses, package/lock diff inspection, package/audit output, and baseline limitations. |

## Baseline handoff

The live CI matrix in `.github/workflows/ci.yml` runs the test job on Node 18, 20, and 22. The current workspace has Node 22 only; Node 18/20 must be recorded as unavailable locally, not represented as passed local evidence. CI matrix results are the external executable handoff for those baselines.

## Required manual/evidence lanes

Confirm the two pre-existing dirty files `.planning/config.json` and `.planning/ui-reviews/.gitignore` remain untouched and unstaged by Phase 14. Confirm `git diff --check` and inspect package/lock diffs before accepting QUAL-03 evidence.
