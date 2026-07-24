---
phase: 14-static-quality-reproducibility
plan: 02
subsystem: testing
tags: [prettier, reproducibility, npm, package-boundary, ci]
requires:
  - phase: 14-static-quality-reproducibility
    provides: ESLint cleanup and lint-safe evidence boundaries from Plan 14-01
provides:
  - Explicit maintained Prettier scope with documented exclusions
  - Regression coverage for formatting scope and zero-production-dependency invariants
  - Node 22 clean-install evidence with Node 18/20 CI handoff
affects: [release-gates, documentation, ci, packaging]
tech-stack:
  added: []
  patterns: [explicit Prettier CLI scope, lockfile-root dependency invariant]
key-files:
  created:
    - .planning/phases/14-static-quality-reproducibility/14-QUAL-03-EVIDENCE.md
  modified:
    - package.json
    - .prettierignore
    - test/eslint-prettier-config.test.js
    - test/package-boundary.test.js
key-decisions:
  - "Use explicit Prettier maintained roots plus --ignore-unknown for shell files; keep .github workflows as a separately tested non-Prettier surface."
  - "Record Node 22 locally and hand Node 18/20 evidence to the existing CI matrix rather than claiming unavailable local runs."
requirements-completed: [QUAL-02, QUAL-03]
coverage:
  - id: D1
    description: Explicit, reviewable Prettier policy covers maintained source, browser, tests, docs, and root configuration while documenting exclusions.
    requirement: QUAL-02
    verification:
      - kind: integration
        ref: test/eslint-prettier-config.test.js
        status: pass
      - kind: other
        ref: npm run format:check
        status: pass
    human_judgment: false
  - id: D2
    description: Clean npm installation preserves the zero-production-dependency package boundary and reproduces quality/package gates.
    requirement: QUAL-03
    verification:
      - kind: integration
        ref: test/package-boundary.test.js
        status: pass
      - kind: other
        ref: .planning/phases/14-static-quality-reproducibility/14-QUAL-03-EVIDENCE.md
        status: pass
    human_judgment: false
duration: 22m
completed: 2026-07-18
status: complete
---

# Phase 14 Plan 02: Static Quality & Reproducibility Summary

**Explicit maintained Prettier coverage and clean-install package reproducibility with zero production dependency drift**

## Performance

- **Duration:** 22m
- **Started:** 2026-07-18T10:32:00Z
- **Completed:** 2026-07-18
- **Tasks:** 2
- **Files modified:** 70 tracked files, plus one evidence artifact

## Accomplishments

- Replaced broad `prettier --check .` with explicit maintained runtime, browser, test, docs, and root config/documentation paths; shell files are safely included with `--ignore-unknown`.
- Documented intentional exclusions for vendored/generated/cache content, package lockfile, historical planning/archive artifacts, and separately owned GitHub workflows; normalized the maintained scope so the check passes.
- Added scope regression tests and package-boundary assertions, then completed the clean `npm ci` → test → lint → format → audit → pack sequence under Node 22 with explicit Node 18/20 CI handoff.

## Task Commits

1. **Task 1 RED:** `603a66e` (test: define explicit Prettier scope policy)
2. **Task 1 GREEN:** `da340d5` (feat: enforce explicit maintained Prettier scope)
3. **Task 2:** `df29566` (test: prove clean-install dependency boundary)

## Files Created/Modified

- `package.json` - explicit `format:check` scope and unknown-file handling.
- `.prettierignore` - documented vendor, generated, historical, and workflow exclusions.
- `test/eslint-prettier-config.test.js` - required-root and exclusion policy regressions.
- `test/package-boundary.test.js` - package/lock production and development dependency invariants.
- `.planning/phases/14-static-quality-reproducibility/14-QUAL-03-EVIDENCE.md` - local gate results and baseline handoff.
- Maintained source/tests/docs - normalized to the now-enforced Prettier scope.

## Decisions Made

- Prettier owns explicit maintained paths; `.github` workflow YAML remains a maintained but non-Prettier surface validated by workflow tests.
- Node 22 is the only local runtime evidence; Node 18/20 are explicitly delegated to the existing CI matrix.
- No package versions, dependency declarations, or lockfile entries were changed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Shell files could not be parsed by Prettier**
- **Found during:** Task 1 verification
- **Issue:** Including the maintained `*.sh` scope caused Prettier parser errors.
- **Fix:** Added `--ignore-unknown`, preserving explicit shell visibility without pretending Prettier owns shell syntax.
- **Verification:** `npm run format:check` passed.
- **Committed in:** `da340d5`

**2. [Rule 1 - Bug] Formatting-sensitive evidence tests failed after maintained content normalization**
- **Found during:** Task 2 clean-install verification
- **Issue:** Five tests asserted exact Markdown/JSX whitespace and failed after the required formatting pass.
- **Fix:** Made those assertions whitespace-tolerant while retaining their semantic checks.
- **Files modified:** `test/adapter-contract.test.js`, `test/cross-platform-evidence.test.js`, `test/host-evidence-matrix.test.js`, `test/tier1-acceptance.test.js`, `test/views-a11y-recovery.test.js`.
- **Verification:** Full `npm test` passed with 505 tests, 1 expected skip, and 0 failures.
- **Committed in:** `df29566`

**Total deviations:** 2 auto-fixed (Rule 3: 1, Rule 1: 1)
**Impact on plan:** Necessary to make the explicit maintained policy executable and keep regression coverage semantic rather than whitespace-fragile.

## Issues Encountered

Node 18 and Node 20 were unavailable locally. This is recorded as an evidence limitation, with the existing CI matrix as the executable handoff; no unavailable local success is claimed.

## Known Stubs

None introduced by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

QUAL-02 and QUAL-03 are complete. The repository has an explicit, reviewable formatting policy and reproducibility evidence suitable for the remaining release-hardening audit.

## Self-Check: PASSED

- Summary and QUAL-03 evidence files exist.
- Task commits `603a66e`, `da340d5`, and `df29566` exist in git history.
- `git diff --check` passes.
- Protected pre-existing dirty files remain unstaged and unmodified by this plan.

---
*Phase: 14-static-quality-reproducibility*
*Completed: 2026-07-18*
