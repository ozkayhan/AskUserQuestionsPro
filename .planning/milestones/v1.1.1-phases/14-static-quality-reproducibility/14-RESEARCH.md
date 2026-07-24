# Phase 14: Static Quality & Reproducibility - Research

**Researched:** 2026-07-18
**Domain:** ESLint, Prettier scope, npm lockfile reproducibility, release quality gates
**Confidence:** HIGH for repository findings; MEDIUM for tool guidance

## User Constraints

- Preserve Node.js 18+ support and the current supported host platforms. [VERIFIED: .planning/PROJECT.md]
- Preserve zero production dependencies and the current package distribution contract. [VERIFIED: .planning/PROJECT.md]
- Every reliability/quality change must retain automated regression coverage; cross-boundary checks need a manual or integration path. [VERIFIED: .planning/PROJECT.md]
- Do not blindly format archived historical artifacts; preserve historical rationale and evidence. [VERIFIED: .planning/REQUIREMENTS.md]
- Do not add production dependencies or create unrelated formatting churn. [VERIFIED: .planning/ROADMAP.md]

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| QUAL-01 | `npm run lint` completes with zero errors using the declared development toolchain. | Exact 17-error inventory and per-file remediation guidance below. |
| QUAL-02 | `npm run format:check` completes with zero differences under explicit, reviewable scope that does not hide application source. | Proposed maintained-scope contract, ignore rules, and scope tests below. |
| QUAL-03 | Clean `npm ci` reproduces test/lint/format/package/audit commands without production dependency changes. | Lockfile/package audit, clean-checkout command sequence, and regression checks below. |

## Summary

The repository’s declared toolchain is already present in `package.json` and `package-lock.json`: ESLint 9 flat config, Prettier 3, Babel parsing for browser JSX, React Hooks linting, native `node:test`, and no `dependencies` section. [VERIFIED: package.json] [VERIFIED: package-lock.json] The current Node runtime is v22.23.1 and npm is 10.9.8; the package declares Node `>=18`, so Node 18/20/22 remain the supported verification matrix documented by CI. [VERIFIED: shell: node/npm --version] [VERIFIED: package.json] [VERIFIED: .github/workflows/ci.yml]

`npm run lint` currently fails with exactly 17 errors in five files: unused policy locals in `lib/bridge-client.mjs` and `server/server.js`, an unused `roundId` declaration in the `/ask` handler, three empty catches in the Playwright CLI evidence test, one empty catch plus browser-global/evaluated-global errors in the Playwright Node test, and one unnecessary regex escape in the host evidence test. [VERIFIED: npm run lint] These are local correctness/configuration issues, not evidence for weakening `no-unused-vars`, `no-empty`, or `no-undef` globally.

The current `prettier --check .` traverses maintained source/tests/docs and `.planning/` history, reporting 138 files. [VERIFIED: npm run format:check] The reviewable solution is to define a deliberate maintained scope: application/runtime files, browser files, tests/fixtures/evidence, maintained `docs/`, and root quality/config files; exclude vendored/generated content, lockfile, tool bundles, caches, and historical planning/archive artifacts. Use explicit CLI globs or a documented scope manifest so source is visibly included rather than relying on a broad command whose exclusions are accidental. [CITED: https://prettier.io/docs/ignore] [CITED: https://github.com/eslint/eslint/blob/main/docs/src/use/configure/configuration-files.md]

**Primary recommendation:** fix each lint finding at its semantic owner, add tests for the lint/format scope and dependency invariants, and change `format:check` to an explicit maintained-file scope while preserving the existing rule set and package allowlist.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Runtime lint fixes | API / Backend | Browser / Client | The failing runtime variables belong to bridge-client/server; browser evidence has its own globals and test environment. [VERIFIED: lint output; source grep] |
| Browser evidence lint compatibility | Browser / Client | API / Backend | Browser tests evaluate DOM globals and vendored page globals; declarations must be local to the test boundary, not global ESLint suppression. [VERIFIED: test/browser-settings-e2e.test.js] |
| Formatting scope | API / Backend | Browser / Client | The scope covers maintained runtime, UI, tests, docs, and config; exclusions are repository/tooling boundaries. [VERIFIED: package.json; git ls-files] |
| Reproducible toolchain | Database / Storage | — | `package-lock.json` is the authoritative npm dependency graph; npm CI must install the declared dev toolchain without adding runtime dependencies. [VERIFIED: package-lock.json; package.json] |

## Standard Stack

### Core

| Library/tool | Declared version | Current registry version | Purpose | Evidence |
|-------------|-----------------|-------------------------|---------|----------|
| ESLint | `^9.15.0` | `10.7.0` | Static JS/ESM/CommonJS lint | [VERIFIED: npm registry] `npm view eslint version`; keep the lock-resolved version for this phase. |
| Prettier | `^3.3.3` | `3.9.5` | Deterministic formatting/checking | [VERIFIED: npm registry] `npm view prettier version`; keep the lock-resolved version for this phase. |
| `@babel/eslint-parser` + `@babel/preset-react` | `^7.24.0` | `8.0.1` | Parse JSX in `web/**/*.js` | [VERIFIED: npm registry] Package names and registry versions confirmed; do not upgrade during a lint-only phase. |
| `eslint-plugin-react-hooks` | `^5.0.0` | `7.1.1` | Hook rules for browser code | [VERIFIED: npm registry] Keep current lock resolution unless a separate compatibility decision is made. |
| npm lockfile | lockfile v3 | n/a | Reproducible dev installation | [VERIFIED: package-lock.json] |

### Supporting

| Tool | Purpose | When to use |
|------|---------|-------------|
| `node:test` | Regression suite | `npm test`; the repository has 50 `*.test.js` files. [VERIFIED: package.json; find test] |
| `npm pack --dry-run --json` | Published file boundary | Package-boundary regression and final release proof. [VERIFIED: test/package-boundary.test.js] |
| `npm audit --omit=dev --audit-level=high` | Production dependency audit | Prove the zero-runtime-dependency boundary; current result is 0 vulnerabilities. [VERIFIED: command output] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Explicit Prettier globs | `prettier --check .` plus a large ignore file | Broad traversal is simpler but currently includes historical planning documents and makes scope less reviewable. [VERIFIED: npm run format:check] |
| Local browser-global declarations | Global `/* eslint-disable */` or ignoring browser tests | Global suppression hides real undefined names; local declarations preserve `no-undef`. [ASSUMED] |

**Installation:**

```bash
npm ci
```

Do not run `npm install` or update versions in this phase. `npm ci --dry-run --ignore-scripts` currently reports “up to date”; a real clean-checkout `npm ci` is still required for QUAL-03. [VERIFIED: command output]

## Package Legitimacy Audit

No new package is recommended. The existing dev-only packages were registry-checked for this research; the legitimacy seam returned `OK` for `@eslint/js`, `eslint-config-prettier`, `@babel/core`, `@babel/eslint-parser`, `@babel/preset-react`, and `eslint-plugin-react-hooks`, and `SUS` only because its freshness heuristic flagged `@changesets/cli`, `eslint`, `globals`, and `prettier` as recently published in this environment. [VERIFIED: gsd package-legitimacy check] The `SUS` results are existing toolchain entries, not a reason to add or upgrade packages; planner should not install any new package.

| Package set | Registry | Postinstall | Disposition |
|-------------|----------|-------------|-------------|
| Existing ESLint/Prettier/Babel/Changesets devDependencies | npm | No network/filesystem postinstall found in registry query. [VERIFIED: npm view] | Retain; no new installs or version drift. |

## Architecture Patterns

### Lint-fix pattern: preserve rule intent

Fix unused values by removing dead assignments when they have no side effect, or rename only intentionally unused parameters with the repository’s existing `_` convention. [CITED: https://github.com/eslint/eslint/blob/main/docs/src/rules/no-unused-vars.md] The two policy locals in `askBridge` and the two module-level policy locals have no references in the inspected regions; confirm with `rg` and remove them unless a lifecycle side effect is discovered. The `/ask` handler’s `roundId` is declared but never assigned/used; remove that declaration while retaining the `roundId` used by `/resume`. [VERIFIED: rg and source inspection]

### Test-environment pattern: declare evaluated browser globals locally

`browser-settings-e2e.test.js` passes callbacks to Playwright that execute in the page, but ESLint parses those callbacks in the Node test file. Declare the evaluated names (`document`, `innerWidth`, and the page-loaded `Settings_Schema`) at the smallest appropriate scope or use a narrowly scoped ESLint environment comment for the callback, with a comment explaining the browser execution boundary. Do not ignore the whole test file. [ASSUMED: implementation choice; must be validated by lint]

### Explicit formatting pattern

Use a named set of root globs in `package.json`, for example separate runtime/browser/test/docs/config groups, and invoke Prettier with those paths from `format:check`; keep `.prettierignore` for vendor/generated/cache exclusions. Prettier supports multiple CLI patterns and negated patterns, and `.prettierignore` uses gitignore syntax. [CITED: https://prettier.io/docs/ignore] A test should assert every required maintained root is present and every intentional exclusion is represented, preventing future silent source omission.

### Resolved scope and baseline decisions

- `deliveryPolicy` and `closurePolicy` are pure transformations over `runtimeSettings(source)` in `lib/runtime-settings.cjs`; their assigned results in `lib/bridge-client.mjs` `askBridge` and `server/server.js` are unused and have no side effect. The live consumers remain `waitForPending`/the delivery flow and `server/bridge.js`. Plan 14-01 removes only the duplicate unused reads/imports and keeps bridge-owned policy reads intact. [VERIFIED: source and runtime-settings tests]
- `.github/workflows/*.yml` is maintained repository policy but is outside the Phase 14 Prettier-owned set. CI already validates workflow structure through dedicated tests, so workflow formatting is not silently claimed by this gate. [VERIFIED: `.github/workflows/ci.yml`, `docs/testing.md`, workflow tests]
- The supported Node baseline is the CI matrix `[18, 20, 22]`. This workspace has Node `v22.23.1`/npm `10.9.8`; Node 18 and 20 are not locally available. The phase records local Node 22 evidence and an explicit external handoff for Node 18/20; CI remains executable evidence for those baselines. [VERIFIED: CI, package.json, shell]

### Recommended project scope

Include: `bin/`, `hooks/`, `lib/`, `mcp-server/`, `server/`, `web/` excluding `web/vendor/`, `test/`, maintained `docs/`, and root maintained config/docs such as `package.json`, `eslint.config.js`, `.prettierrc.json`, `README.md`, and shell scripts. Exclude `.github/` workflow YAML from the Prettier command and document it as a separate maintained, non-Prettier YAML surface. [RESOLVED: repository CI/workflow ownership]

Exclude: `node_modules/`, `package-lock.json` (already excluded), `web/vendor/`, `.context/`, `.codex/`, `.omo/`, `.planning/research/.cache/`, `docs/archive/`, and historical `.planning/` milestone/debug/research artifacts. The last group is required by the out-of-scope requirement against blindly formatting historical artifacts. [VERIFIED: .prettierignore; .planning/REQUIREMENTS.md]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dependency reproducibility | A custom installer or lockfile parser | `npm ci` with committed lockfile | npm’s clean-install contract is the repository’s existing release/CI path. [VERIFIED: .github/workflows/ci.yml; docs/testing.md] |
| Browser JSX parsing | Ad hoc parser flags or file-wide disables | Existing Babel parser/preset configuration | The project already has a dedicated browser parser boundary. [VERIFIED: eslint.config.js] |
| Formatting selection | A script that walks files and reimplements ignore semantics | Prettier CLI globs plus `.prettierignore` | Prettier already defines glob and ignore behavior. [CITED: https://prettier.io/docs/ignore] |

## Common Pitfalls

### Pitfall 1: Removing a policy read that is semantically required

**What goes wrong:** A dead-looking `deliveryPolicy`/`closurePolicy` read may be removed without checking whether reading settings is intended to freeze runtime behavior or trigger validation. **Why:** current lint evidence only proves the local value is unused. **How to avoid:** inspect the policy functions and tests before removal; if the read has no side effect, remove it; if it does, preserve the call and assign to `_delivery`/`_closure` only with a documented invariant. [VERIFIED: lint; source inspection] **Confidence:** MEDIUM.

### Pitfall 2: Fixing `no-undef` by disabling it for browser tests

**What goes wrong:** the test can hide genuine Node-side undefined names. **How to avoid:** narrow declarations/comments to `page.evaluate` callbacks and retain `no-undef` elsewhere. [ASSUMED]

### Pitfall 3: Letting Prettier scope silently omit application code

**What goes wrong:** adding `web/**` or `test/**` to ignores makes the check green while maintained code is unreviewed. **How to avoid:** assert required roots and run a negative scope probe against a temporary malformed maintained fixture during verification, or use explicit globs that visibly name each root. [ASSUMED]

### Pitfall 4: Formatting historical artifacts as a “fix”

**What goes wrong:** 100+ unrelated planning/archive files change, obscuring the hardening diff and violating the requirements. **How to avoid:** exclude historical paths deliberately and record the scope in the config test/docs. [VERIFIED: current 138-file output; requirements]

### Pitfall 5: Accidental dependency drift

**What goes wrong:** `npm install` updates ranges/lockfile or adds a runtime dependency while fixing quality tooling. **How to avoid:** compare `package.json`/lock root before and after, assert `dependencies` is absent/empty, run `npm ci`, `npm audit --omit=dev`, and inspect `git diff -- package.json package-lock.json`. [VERIFIED: package files; docs/testing.md]

## Code Examples

### Required verification sequence

```bash
npm ci
npm test
npm run lint
npm run format:check
npm audit --audit-level=high --omit=dev
npm pack --dry-run --json
```

This sequence is already the maintained release-gate sequence, with shell checks additionally required when shell files change. [VERIFIED: docs/testing.md]

### Scope inspection commands

```bash
npx --no-install prettier --check bin hooks lib mcp-server server test web docs \
  package.json eslint.config.js .prettierrc.json README.md '*.sh'
npx --no-install prettier --list-different <same-maintained-paths>
git diff --stat -- package.json package-lock.json .prettierignore eslint.config.js test lib server web docs
git diff --check
```

The exact glob spelling should be locked in the plan/config test; the example is implementation guidance, not a claim about the final command. [ASSUMED]

## Runtime State Inventory

Not a rename/refactor/migration phase. No runtime-state migration is required. [VERIFIED: ROADMAP phase goal]

## State of the Art

| Old approach | Current approach | Impact |
|--------------|------------------|--------|
| Broad `prettier --check .` with incidental ignores | Explicit maintained roots plus intentional ignore file | Makes source coverage and historical exclusions reviewable. [CITED: https://prettier.io/docs/ignore] |
| Treat lint failures as configuration noise | Fix semantic dead code and test execution-boundary declarations | Keeps `no-unused-vars`, `no-empty`, and `no-undef` meaningful. [CITED: https://github.com/eslint/eslint/blob/main/docs/src/rules/no-unused-vars.md] |
| `npm install` for reproducibility checks | `npm ci` from committed lockfile | Prevents dependency resolution drift. [VERIFIED: .github/workflows/ci.yml; docs/testing.md] |

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Native `node:test`, package script `node --test` [VERIFIED: package.json] |
| Config file | None [VERIFIED: docs/testing.md] |
| Quick run command | `node --test test/eslint-prettier-config.test.js` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| QUAL-01 | Lint has zero errors and meaningful rules remain configured | integration/config | `npm run lint` | Existing config test; extend it for scope/rule invariants [VERIFIED: test/eslint-prettier-config.test.js] |
| QUAL-02 | Maintained source/docs/tests are checked and historical/vendor paths are excluded intentionally | integration/config | `npm run format:check` plus focused config test | Existing config test; scope assertions are a Wave 0 gap [VERIFIED: test/eslint-prettier-config.test.js] |
| QUAL-03 | Clean install exposes all commands with no production dependency drift | integration/package | `npm ci && npm test && npm run lint && npm run format:check && npm audit --omit=dev --audit-level=high && npm pack --dry-run --json` | Existing package/workflow tests; clean-install run is a phase gate [VERIFIED: docs/testing.md; test/package-boundary.test.js] |

### Sampling Rate

- Per task commit: focused config test and the directly affected lint command.
- Per wave merge: `npm test`, `npm run lint`, `npm run format:check`.
- Phase gate: clean-checkout sequence above, plus package boundary and production audit checks.

### Wave 0 Gaps

- [ ] Add/extend `test/eslint-prettier-config.test.js` to assert required maintained roots and intentional exclusions.
- [ ] Add a dependency invariant assertion that root package and lockfile have no production dependencies and matching dev dependency names.
- [ ] Record a clean `npm ci` run on Node 18, or explicitly hand off unavailable Node 18 evidence while running the local Node 22 proof.

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Local single-user tool; no auth change in scope. [VERIFIED: .planning/PROJECT.md] |
| V3 Session Management | no | No session/auth change in scope. [VERIFIED: project architecture] |
| V4 Access Control | yes | Preserve existing localhost-only and capability/round identity checks; lint fixes must not alter them. [VERIFIED: project constraints; source] |
| V5 Input Validation | yes | Preserve existing boundary validation and tests; no weakening of parser/lint gates. [VERIFIED: architecture; test/server.test.js] |
| V6 Cryptography | no | No cryptographic change in scope. [VERIFIED: phase goal] |

| Threat pattern | STRIDE | Mitigation |
|---------------|--------|------------|
| Quality-scope omission hides unreviewed source | Tampering | Test required roots and run explicit maintained globs. [ASSUMED] |
| Dependency drift introduces unintended runtime package | Tampering | `npm ci`, package/lock root comparison, empty production dependency assertion, npm audit. [VERIFIED: package files] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Local browser globals should be declared narrowly around evaluated callbacks. | Architecture Patterns | A declaration could be placed incorrectly and mask a real test defect. |
| A2 | The final Prettier command should use explicit maintained roots rather than only a larger ignore list. | Architecture Patterns / Code Examples | The command may need adjustment for cross-platform shell/glob behavior. |
| A3 | `.github/` YAML is a maintained non-Prettier surface covered by workflow tests. | Resolved scope | Workflow formatting remains outside this phase’s ownership. |
| A4 | `deliveryPolicy`/`closurePolicy` duplicate reads are pure and unused; bridge-owned reads remain required. | Resolved policy decision | Source and runtime-settings tests establish the distinction. |

## Open Questions (RESOLVED)

1. **Policy reads — resolved:** Direct source inspection shows the helpers are pure; remove unused duplicate reads, while `server/bridge.js` retains the policy values it stores and uses. [VERIFIED: source and runtime-settings tests]
2. **`.github/` formatting — resolved:** Workflows are maintained but outside the Prettier gate; workflow-specific tests remain their validation surface. [VERIFIED: CI and workflow test inventory]
3. **Node baseline evidence — resolved:** Run and record the full clean sequence under local Node 22; cite CI matrix jobs for Node 18/20 and explicitly mark those local baselines unavailable. [VERIFIED: CI and current shell]
   - What we know: package and CI declare Node 18/20/22; this workspace proves Node 22 only. [VERIFIED: package.json; CI; shell]
   - Evidence action: record local-versus-CI status in `14-QUAL-03-EVIDENCE.md`; never claim unavailable local success.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | all commands | ✓ | v22.23.1 | CI matrix for 18/20 [VERIFIED: shell; CI] |
| npm | install/audit/package | ✓ | 10.9.8 | none [VERIFIED: shell] |
| ESLint/Prettier | lint/format | ✓ | lock-resolved executables | `npm ci` [VERIFIED: command runs] |
| Playwright CLI/Node package | browser evidence tests | partial | CLI/package availability varies; browser Node test skips when package absent | Phase 14 only needs linting; preserve skip semantics [VERIFIED: test source] |
| ShellCheck | CI/release shell gate | not checked in this audit | — | CI or maintainer environment; not needed for application-file lint fix unless shell files change [ASSUMED] |

## Sources

### Primary (HIGH confidence)

- `package.json`, `package-lock.json`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore` — repository-declared stack and scope. [VERIFIED: codebase]
- `npm run lint`, `npm run format:check`, `npm audit --omit=dev --audit-level=high` — current failure and baseline evidence. [VERIFIED: commands]
- `.github/workflows/ci.yml`, `docs/testing.md`, `test/eslint-prettier-config.test.js`, `test/package-boundary.test.js` — existing verification contracts. [VERIFIED: codebase]
- [ESLint configuration files](https://github.com/eslint/eslint/blob/main/docs/src/use/configure/configuration-files.md) — flat-config global ignore behavior. [CITED: official docs]

### Secondary (MEDIUM confidence)

- [ESLint `no-unused-vars` documentation](https://github.com/eslint/eslint/blob/main/docs/src/rules/no-unused-vars.md) — unused-variable remediation options. [CITED: official docs]
- [Prettier ignore documentation](https://prettier.io/docs/ignore) — gitignore syntax and ignore-file behavior. [CITED: official docs]
- Context7 `/eslint/eslint` and `/prettier/prettier` — current documentation snippets for flat config and CLI ignore patterns. [CITED: Context7]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — package/lock and registry checks agree; no package upgrade is recommended.
- Architecture: HIGH — current file ownership and failures were inspected directly; browser-global placement remains MEDIUM.
- Pitfalls: MEDIUM — repository evidence is strong; proposed scope/testing policy has planner-level decisions.

**Research date:** 2026-07-18
**Valid until:** 2026-08-17 for stable repository facts; registry versions should be rechecked before any dependency change.
