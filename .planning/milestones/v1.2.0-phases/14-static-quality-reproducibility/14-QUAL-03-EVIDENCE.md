---
phase: 14-static-quality-reproducibility
requirement: QUAL-03
status: verified
---

# QUAL-03 Clean-install and reproducibility evidence

## Local execution

This workspace records the complete gate under the available local runtime:

| Check | Result |
| --- | --- |
| Node | `v22.23.1` |
| npm | `10.9.8` |
| `npm ci` | PASS; 231 packages installed, 0 vulnerabilities reported |
| `npm test` | PASS; 505 tests passed, 1 expected Playwright skip, 0 failures |
| `npm run lint` | PASS |
| `npm run format:check` | PASS; explicit maintained scope |
| `npm audit --omit=dev --audit-level=high` | PASS; 0 vulnerabilities |
| `npm pack --dry-run --json` | PASS; 41 package files, unpacked size 3,689,659 bytes |
| `git diff --check` | PASS |
| `git diff -- package.json package-lock.json` | CLEAN; no manifest or lockfile drift |

The final sequence was run from the committed lockfile in this order: `npm ci`,
`npm test`, `npm run lint`, `npm run format:check`, `npm audit --omit=dev
--audit-level=high`, and `npm pack --dry-run --json`.

## Baseline handoff

Node 18 and Node 20 are not installed in this workspace, so no local success is
claimed for those versions. The external executable handoff is the matrix in
`.github/workflows/ci.yml`, which runs the test job on Node 18, 20, and 22;
the lint job currently runs on Node 20. CI results for those jobs remain the
authoritative evidence for unavailable local baselines.

## Scope and dependency conclusions

- `format:check` names `bin`, `hooks`, `lib`, `mcp-server`, `server`, `test`,
  `web`, `docs`, and maintained root configuration/documentation explicitly.
- `web/vendor`, `node_modules`, `package-lock.json`, generated caches, archived
  docs, historical planning artifacts, and `.github` workflows are documented
  exclusions or separate validation surfaces; application roots are not hidden.
- `package.json` has no production dependencies, and the lockfile root has no
  production dependency entries. The focused package test confirms the declared
  development dependency names and ranges match the lockfile root.
- The pre-existing dirty files `.planning/config.json` and
  `.planning/ui-reviews/.gitignore` were not modified or staged. The unrelated
  pre-existing `.playwright-cli/` directory was also left untouched.

## Regression note

The initial scope formatting pass exposed five brittle text-based tests whose
exact whitespace assumptions changed when maintained Markdown/JSX was
normalized. Their assertions were made whitespace-tolerant without changing
runtime behavior; the final full suite passed.
