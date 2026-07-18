---
phase: 14-static-quality-reproducibility
verified: 2026-07-18T11:20:00Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
external_handoffs:
  - "Node 18 and Node 20 were not installed locally; CI matrix remains the executable handoff."
  - "The optional Playwright Node-package browser test remains skipped; playwright-cli evidence and existing documented skip semantics remain available."
re_verification: false
---

# Phase 14: Static Quality & Reproducibility Verification Report

**Phase Goal:** Maintainers can install the declared development toolchain from a clean checkout and run lint, formatting, tests, packaging, and audit entry points reproducibly without broad unreviewed churn or production dependency changes.
**Verified:** 2026-07-18T11:20:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | `npm run lint` completes with zero errors using the repository-declared toolchain. | ✓ VERIFIED | Independent `npm run lint` passed; `eslint.config.js` still enforces `no-unused-vars`, `no-empty`, browser hooks, and the existing parser coverage. |
| 2 | `npm run format:check` completes with zero differences under an explicit maintained scope that includes application source. | ✓ VERIFIED | Independent `npm run format:check` passed. `package.json` names `bin`, `hooks`, `lib`, `mcp-server`, `server`, `test`, `web`, `docs`, root configs, README, and shell files; scope tests passed. |
| 3 | A clean `npm ci` exposes working test, lint, format, package, and audit commands. | ✓ VERIFIED | Fresh `npm ci` added 231 packages with 0 vulnerabilities; full `npm test` passed 505 tests with 1 expected Playwright skip; lint, format, audit, and `npm pack --dry-run --json` all passed. |
| 4 | Hardening preserves zero production dependencies and avoids unrelated formatting churn. | ✓ VERIFIED | Package-boundary tests passed; `package.json` has no production dependencies, lockfile root has no production entries, and `git diff package.json package-lock.json` contains no dependency drift. The broad formatting changes are confined to the explicit maintained scope; vendored/generated/archive/planning content and `.github` workflows are documented exclusions/separate validation surfaces. |

**Score:** 4/4 truths verified (0 present, behavior-unverified)

## Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `package.json` | Deterministic lint/format commands and unchanged production boundary | ✓ VERIFIED | Explicit `format:check` scope; no production dependencies; package dry-run succeeds. |
| `.prettierignore` | Reviewable vendor/generated/archive/workflow exclusions | ✓ VERIFIED | Documents `web/vendor`, `node_modules`, lockfile, caches, historical `.planning`, `docs/archive`, and `.github` policy. |
| `eslint.config.js` | Meaningful lint rules remain active | ✓ VERIFIED | No global/file-wide suppression added; configured rules inspected and lint passes. |
| `test/eslint-prettier-config.test.js` | Formatting and lint policy regression coverage | ✓ VERIFIED | 13 focused subtests passed. |
| `test/package-boundary.test.js` | Zero-production-dependency/package allowlist coverage | ✓ VERIFIED | 3 focused subtests passed. |
| `14-QUAL-03-EVIDENCE.md` | Reproducibility results and baseline handoff | ✓ VERIFIED | Records Node 22/npm 10.9.8, clean-install sequence, package/audit results, and Node 18/20 limitation. |

## Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `package.json` | maintained source roots | `format:check` script | ✓ WIRED | Explicit roots are executable and passed. |
| `.prettierignore` | lint/format policy | documented matching exclusions | ✓ WIRED | Focused policy tests passed; app roots are not hidden. |
| `package.json` | `package-lock.json` | npm dependency graph | ✓ WIRED | Package-boundary tests and clean `npm ci` passed; no manifest/lock drift. |
| CI workflow | unavailable Node baselines | Node 18/20/22 test matrix and Node 20 lint job | ✓ WIRED | `.github/workflows/ci.yml` inspected; local evidence is limited to Node 22. |

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `package.json` quality scripts | command paths/globs | repository files and installed dev toolchain | Yes | ✓ FLOWING |
| `test/package-boundary.test.js` | manifest/lock metadata | `package.json` and `package-lock.json` | Yes | ✓ FLOWING |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Policy and package invariants | `node --test test/eslint-prettier-config.test.js test/package-boundary.test.js` | 16 passed, 0 failed | ✓ PASS |
| Phase 14 runtime/evidence regressions | focused `node --test` command from `14-VALIDATION.md` | 73 passed, 1 expected skip, 0 failed | ✓ PASS |
| Full workspace suite after clean install | `npm ci && npm test` | 505 passed, 1 expected Playwright skip, 0 failed | ✓ PASS |
| Lint gate | `npm run lint` | exit 0 | ✓ PASS |
| Format gate | `npm run format:check` | all matched files formatted | ✓ PASS |
| Production audit | `npm audit --omit=dev --audit-level=high` | 0 vulnerabilities | ✓ PASS |
| Package boundary | `npm pack --dry-run --json` | 41 files, no bundled dependencies | ✓ PASS |

## Probe Execution

No Phase 14 probe script was declared or required; the validation map specifies direct npm/node commands instead.

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| QUAL-01 | 14-01 | Lint succeeds with declared rules active | ✓ SATISFIED | Independent lint and focused runtime/evidence suites pass. |
| QUAL-02 | 14-02 | Explicit format scope does not hide application source | ✓ SATISFIED | Scope regression tests and format gate pass; exclusions are documented. |
| QUAL-03 | 14-02 | Clean install reproduces gates without production dependency drift | ✓ SATISFIED | Clean `npm ci`, full tests, lint, format, audit, pack, and package-boundary evidence pass. |

No Phase 14 requirements are orphaned in `REQUIREMENTS.md`.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---:|---|---|---|
| — | — | No unreferenced `TBD`, `FIXME`, or `XXX` markers in Phase 14 modified application files | None | No blocker found. |

The `TBD` strings found by the scan are future-phase placeholders in the roadmap, not debt markers in Phase 14 implementation files.

## External Handoff Gaps

1. Node 18 and Node 20 were unavailable in this workspace. The repository CI matrix is configured for Node 18, 20, and 22; CI results remain the external executable evidence for those local-baseline gaps.
2. The optional Playwright Node package is unavailable, so the browser settings Node test is an expected skip. This phase is static-quality/reproducibility scope; browser visual/accessibility validation is explicitly owned by Phase 15. Existing `playwright-cli` evidence remains separate and was not treated as equivalent to the skipped Node test.
3. ShellCheck was not run locally because no shell files were changed by the phase’s behavior fixes; the CI lint job remains the handoff for that gate.

## Worktree Safety

The pre-existing dirty `.planning/config.json`, `.planning/ui-reviews/.gitignore`, and untracked `.playwright-cli/` were not touched or staged. Phase metadata changes are limited to the requested verification state/roadmap updates and this report. No commit was created.

## Gaps Summary

No blocking gaps. Phase 14 achieves QUAL-01, QUAL-02, and QUAL-03. External baseline/browser evidence is explicitly handed off and is not represented as local success.

---

_Verified: 2026-07-18T11:20:00Z_
_Verifier: the agent (gsd-verifier)_
