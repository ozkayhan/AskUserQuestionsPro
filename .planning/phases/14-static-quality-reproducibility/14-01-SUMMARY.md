---
phase: 14-static-quality-reproducibility
plan: 01
subsystem: testing
tags: [eslint, node, browser-evidence, static-quality]
requires:
  - phase: 13
    provides: runtime settings, durable bridge recovery, and host evidence tests
provides:
  - lint-clean runtime and evidence-test files
  - preserved ESLint no-unused-vars, no-empty, no-undef, and no-useless-escape enforcement
affects: [phase-14-plan-02, static-quality, release-gates]
tech-stack:
  added: []
  patterns: [browser-evaluate globals referenced through globalThis, documented best-effort evidence cleanup]
key-files:
  created: []
  modified: [lib/bridge-client.mjs, server/server.js, test/browser-settings-cli-e2e.js, test/browser-settings-e2e.test.js, test/host-evidence-matrix.test.js]
key-decisions:
  - "Removed only pure, unused duplicate runtime policy reads; policy consumers remain in their owning bridge flow."
  - "Used globalThis at Playwright page-evaluation boundaries instead of weakening Node-side no-undef."
requirements-completed: [QUAL-01]
coverage:
  - id: D1
    description: "The exact 17 baseline ESLint errors are removed while meaningful lint rules remain enabled."
    requirement: QUAL-01
    verification:
      - kind: integration
        ref: "npm run lint"
        status: pass
      - kind: unit
        ref: "test/eslint-prettier-config.test.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "Bridge lifecycle, request identity, recovery, and host evidence behavior remain covered after lint cleanup."
    requirement: QUAL-01
    verification:
      - kind: integration
        ref: "node --test test/bridge-client.test.js test/server.test.js test/runtime-settings.test.js test/browser-settings-cli-e2e.js test/browser-settings-e2e.test.js test/host-evidence-matrix.test.js"
        status: pass
    human_judgment: false
metrics:
  duration: 9m
  completed: 2026-07-18
status: complete
---

# Phase 14 Plan 01: ESLint Error Cleanup Summary

**Removed the exact 17 ESLint errors from bridge runtime and browser/host evidence tests without weakening static rules or changing runtime behavior.**

## Performance

- **Duration:** 9 minutes
- **Started:** 2026-07-18T10:24:00Z
- **Completed:** 2026-07-18T10:33:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Removed unused duplicate delivery/closure policy reads and the unused `/ask` round binding while preserving `/resume` identity handling and bridge-owned policy consumers.
- Made Playwright browser globals explicit at the execution boundary and documented intentional startup, screenshot, and session cleanup recovery.
- Removed the unnecessary host-evidence regex escape; `npm run lint`, focused suites, config validation, and `git diff --check` pass.

## Task Commits

1. **Task 1: Resolve runtime unused locals without changing semantics** - `f5d194c` (fix)
2. **Task 2: Make evidence-test boundaries explicit and clear remaining errors** - `4395f67` (fix)

## Files Created/Modified

- `lib/bridge-client.mjs` - removes unused policy reads while retaining the used retry policy.
- `server/server.js` - removes unused policy imports/locals and `/ask` round binding.
- `test/browser-settings-cli-e2e.js` - makes intentional best-effort catches lint-visible.
- `test/browser-settings-e2e.test.js` - references page globals through `globalThis`.
- `test/host-evidence-matrix.test.js` - removes the unnecessary regex escape.

## Decisions Made

- Kept all existing lint rules active; no file-wide or global suppression was added.
- Treated browser-evaluated names as page globals only through `globalThis`, keeping Node-side undefined-name detection meaningful.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The focused browser suite skipped the Node Playwright test because the optional Playwright Node package is unavailable; this is the existing documented skip path. The installed `playwright-cli` evidence test passed.
- The verification command generated an untracked `.playwright-cli/` runtime directory containing prior/current evidence logs. It was not staged or modified because it is outside the plan files and contains existing artifacts.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

QUAL-01 is complete. Phase 14 Plan 02 can proceed with the independent Prettier scope and reproducibility work. The pre-existing dirty `.planning/config.json` and `.planning/ui-reviews/.gitignore` files remain untouched and unstaged.

## Self-Check: PASSED

- Summary file exists.
- Task commits `f5d194c` and `4395f67` exist in git history.
- Protected planning files remain unstaged and unchanged by this plan.

---
*Phase: 14-static-quality-reproducibility*
*Completed: 2026-07-18*
