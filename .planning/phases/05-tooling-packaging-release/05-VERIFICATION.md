# Phase 5 Verification: Tooling, Packaging & Release

**Date:** 2026-07-16
**Status:** Passed

## Automated gates

| Gate                                      | Result                                       |
| ----------------------------------------- | -------------------------------------------- |
| `npm ci`                                  | pass; 231 packages, 0 vulnerabilities        |
| `npm test`                                | pass; 387 tests, 0 failures                  |
| `npm run lint`                            | pass                                         |
| `npm run format:check`                    | pass                                         |
| `npm audit --audit-level=high --omit=dev` | pass; 0 vulnerabilities                      |
| `npm pack --dry-run --json`               | pass; 36 allowlisted runtime/install entries |
| `shellcheck --severity=warning`           | pass for maintained shell scripts            |
| `git diff --check`                        | pass                                         |

## Invariants checked

- Node engine remains `>=18`; package and lockfile versions both remain `1.1.0`.
- Runtime dependencies remain empty.
- The published package excludes planning docs, tests, repository docs, and local
  Conductor/GSD bundles.
- CI shellcheck now excludes `.codex/`, matching lint, Prettier, and npm scope.
- Host-specific uninstall keeps shared runtime state when the other host remains
  installed.
- Installer refuses a source path that is the install directory or contains it.

## Remaining validation

Real Codex and Claude long-round host acceptance remains intentionally deferred to
Phase 7; this phase does not claim to prove a host wall-clock deadline.
