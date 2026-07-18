# Phase 19: Final Release Readiness & Ship Gates - Research

**Researched:** 2026-07-18
**Domain:** Clean-checkout release verification, npm packaging, shell installers, CI/Changesets, evidence governance
**Confidence:** HIGH for local repository gates; MEDIUM for external release execution

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REL-01 | Package dry-run, production dependency audit, shell checks, installer lifecycle checks, and release workflow gates pass together. | Exact gate sequence, focused tests, package boundary, shell lifecycle, CI/release workflow checks, and clean-checkout strategy below. |
| REL-02 | Release checklist verifies clean-install, upgrade, uninstall, configuration-scope, and no-destructive-fallback behavior where locally testable. | Isolated HOME/XDG lifecycle matrix and fail-closed installer checks below. |
| REL-03 | Unavailable native Windows and authenticated Claude/Codex validation remain external handoffs and are never promoted. | External evidence policy and ship decision rules below. |
</phase_requirements>

## Summary

Phase 19 should produce a release decision artifact from a clean checkout, not reinterpret the existing dirty workspace. The repository already has executable local contracts for the full test suite, focused release suites, lint, formatting, audit, package dry-run, shell syntax/ShellCheck, package boundary, installer scope, CI workflow shape, release workflow shape, documentation integrity, security fail-closed behavior, archive preservation, and protected-file preservation. [VERIFIED: local repository grep and phase 14–18 verification artifacts]

The current checkout is Node 22.23.1/npm 10.9.8 with ShellCheck 0.11.0 and jq available; CI is the authoritative Node 18/20/22 matrix. The package is version 1.1.0 in `package.json`, while the milestone and maintained evidence call the target v1.1.1; Phase 19 must treat that version mismatch as a release-blocking metadata decision unless the final release commit/versioning step resolves it. [VERIFIED: local command output, package.json, .github/workflows/ci.yml, docs/evidence/v1.1.1-release-handoff.md]

**Primary recommendation:** Run all local gates in a fresh temporary clone/worktree at the exact candidate commit, run installer lifecycle tests with isolated HOME/XDG paths and fake host binaries, record external lanes as `UNAVAILABLE`, and mark shipment `READY` only when every required local gate is PASS and release metadata/version/changeset policy is coherent.

## User Constraints

No Phase 19 CONTEXT.md exists. Locked project constraints remain: Node.js 18+, Claude Code and Codex compatibility, zero production dependencies/current package contract, bridge bound to `127.0.0.1`, automated regression coverage, cross-boundary manual/integration evidence, and preservation of historical rationale. [CITED: AGENTS.md project-doc block]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Quality and release command gates | Repository/tooling | CI | `package.json` scripts are the local contract; CI repeats the matrix and shell/audit gates. [VERIFIED: package.json, .github/workflows/ci.yml] |
| Published package boundary | npm/package metadata | filesystem | `package.json.files`, bins, lockfile root, and `npm pack --dry-run --json` define the artifact. [VERIFIED: package.json, test/package-boundary.test.js] |
| Installer lifecycle and configuration scope | Shell/CLI boundary | isolated HOME/XDG state | Installers mutate host registrations, skills, shared runtime, and settings; lifecycle tests must own temporary state. [VERIFIED: install.sh, uninstall.sh, reinstall.sh, test/shell-lifecycle.test.js] |
| Ship decision and evidence status | Release documentation/planning | CI/external owners | Local PASS, PARTIAL, and UNAVAILABLE rows must remain distinct and external evidence cannot be promoted by omission. [VERIFIED: docs/evidence/v1.1.1-release-handoff.md, Phase 16/17 artifacts] |

## Standard Stack

### Core

| Tool | Version | Purpose | Why Standard |
|---|---|---|---|
| Node.js | `>=18`; local 22.23.1 | Runtime and native `node:test` | Declared engine and CI matrix. [VERIFIED: package.json, .github/workflows/ci.yml] |
| npm | lockfile v3; local 10.9.8 | Reproducible install, audit, pack | `npm ci` is required by docs and workflows; `npm install` is forbidden in workflow tests. [VERIFIED: package-lock.json, docs/testing.md, test/workflows-release.test.js] |
| Native node:test | repository command `npm test` | Full and focused automated verification | No external test runner is used. [VERIFIED: package.json, docs/testing.md] |
| ESLint / Prettier | package-declared dev toolchain | Static quality and maintained formatting scope | Existing scripts and regression tests define the gate. [VERIFIED: package.json, test/eslint-prettier-config.test.js] |
| ShellCheck | local 0.11.0; CI severity warning | Installer shell analysis | CI and maintained release docs require it; missing tool must be recorded, never installed by the gate. [VERIFIED: local command, .github/workflows/ci.yml, docs/testing.md] |

### Supporting

| Tool/pattern | Purpose | When to use |
|---|---|---|
| `npm pack --dry-run --json` | Inspect final npm payload without publishing | Every candidate checkout; assert allowlist and no bundled production dependencies. [VERIFIED: Phase 14 verification, test/release-gates.test.js] |
| `npm audit --audit-level=high --omit=dev` | Production dependency vulnerability gate | Every candidate checkout; `--omit=dev` matches the zero-production-dependency release boundary. [VERIFIED: CI, Phase 17 runner] |
| `ASKUSER_SOURCE_DIR` + isolated `HOME`/`XDG_CONFIG_HOME` | Installer fixture isolation | Install/upgrade/uninstall/reinstall tests without touching the operator profile. [VERIFIED: install.sh, README.md, shell lifecycle tests] |
| Changesets action | Version/package publication workflow | Only after CI succeeds; `release.yml` uses `workflow_run`, full history, npm registry, and OIDC/npm token permissions. [VERIFIED: .github/workflows/release.yml, test/workflows-release.test.js] |

## Exact Local Gate Sequence

Run from the candidate checkout with no user dirty files. Preserve stdout, exit status, Node/npm versions, and timestamp in the final evidence file:

```bash
node --version
npm --version
npm ci
npm test
npm run lint
npm run format:check
npm audit --audit-level=high --omit=dev
npm pack --dry-run --json
bash -n install.sh uninstall.sh reinstall.sh
shellcheck --severity=warning install.sh uninstall.sh reinstall.sh
node --test test/package-boundary.test.js test/release-gates.test.js test/workflows-ci.test.js test/workflows-release.test.js test/host-install-gates.test.js test/shell-lifecycle.test.js
node --test test/docs-integrity.test.js test/host-evidence-matrix.test.js test/cross-platform-evidence.test.js test/fake-host-conformance.test.js
bash .planning/phases/17-security-privacy-audit/17-run-audit.sh
node .planning/phases/18-documentation-release-evidence-sync/18-validate.mjs
git diff --check
```

The Phase 17 runner itself executes the full suite, lint, format, package dry-run, production audit, Bash syntax, ShellCheck, redaction, promotion fail-closed, archive comparison against `7f87a92`, and protected-file comparison; use its generated labels rather than substituting a shorter claim. [VERIFIED: `.planning/phases/17-security-privacy-audit/17-run-audit.sh`]

The Phase 18 validator covers maintained-doc integrity, handoff links/schema, redaction, metadata, archive immutability, protected files, source-edit policy, lint, format, diff-check, and integrity. Run it from the clean candidate checkout; its existing dirty-worktree baseline protocol is for the documentation phase and must not be mistaken for a clean release proof. [VERIFIED: `.planning/phases/18-documentation-release-evidence-sync/18-validate.mjs`, 18-VALIDATION.md]

## Clean-Checkout and Reproducibility Strategy

1. Capture the candidate commit SHA and current dirty state read-only. Do not reset, checkout, clean, stash, or stage the user workspace. The current branch is `update-health-configure-milestone`; it has 21 status entries including protected planning files and `.playwright-cli` artifacts. [VERIFIED: local git command]
2. Create a temporary directory outside the repository and clone/fetch the exact candidate commit into it. If network access is unavailable, use a temporary worktree only from a clean candidate commit and explicitly label that as local isolation rather than a fresh clone. [ASSUMED]
3. In the isolated checkout run `npm ci`, then the exact sequence above. Never copy `node_modules`, `.playwright-cli`, user settings, host registrations, or `.codex` into the candidate. `.codex` is explicitly excluded from package/lint/format scope. [VERIFIED: docs/testing.md]
4. Record `git rev-parse HEAD`, `git status --short`, `npm pack --dry-run --json`, lockfile/manifest checks, and all command exit statuses. A clean release candidate must have no untracked or modified files except deliberately generated evidence stored outside the source candidate or explicitly allowed release artifacts. [VERIFIED: Phase 14 evidence and Phase 18 source-policy design]
5. Compare package contents twice if practical: once before lifecycle tests and once after; the published payload must be identical and contain only the `files` allowlist plus npm metadata. [ASSUMED]

## Package, Audit, and Release Workflow Gates

- Assert `package.json` has no `dependencies`, the lockfile root has no production entries, and `npm pack --dry-run --json` succeeds without bundled dependencies. [VERIFIED: Phase 14 verification, test/package-boundary.test.js]
- Run `npm audit --audit-level=high --omit=dev`; do not convert network failure or an unavailable audit registry into PASS. Record registry errors as an external/environment blocker. [VERIFIED: CI workflow and Phase 17 runner; fail-closed treatment is [ASSUMED] policy recommendation]
- Run the package/release focused tests. They verify package docs, file allowlist, zero production dependencies, shell syntax, ShellCheck availability handling, CI matrix 18/20/22, SHA-pinned actions, release workflow `workflow_run` success guard, full-history checkout, npm registry, token wiring, and no floating action tags. [VERIFIED: test/release-gates.test.js, test/workflows-ci.test.js, test/workflows-release.test.js]
- Confirm release metadata before ship: current `package.json` is `1.1.0` but the milestone is v1.1.1. The planner must add a release-version/changeset checkpoint and fail closed if the intended version is not explicitly resolved. [VERIFIED: package.json, REQUIREMENTS.md, handoff; checkpoint recommendation [ASSUMED]]
- A release publication is CI-gated: `.github/workflows/release.yml` triggers on successful completed CI for `main` or manual dispatch, uses `npm ci`, Changesets, npm registry credentials, full git history, and non-canceling concurrency. [VERIFIED: workflow and workflow tests]

## Installer Lifecycle and Scope Matrix

Use a temporary HOME and XDG directory, fake `claude`/`codex` executables, an ephemeral loopback port, and a source override. Never point `ASKUSER_SOURCE_DIR` at the live install directory; the installer contains a guard because doing so could make recovery destructive. [VERIFIED: install.sh]

| Scenario | Exact local method | Pass evidence |
|---|---|---|
| Clean install | `HOME="$TMP/home" XDG_CONFIG_HOME="$TMP/config" ASKUSER_SOURCE_DIR="$CANDIDATE" bash install.sh --target codex` (repeat `claude`/`all` where host fixture exists) | Runtime files, selected skill/registration, doctor success, no files outside isolated scope. [VERIFIED: installer behavior; test target pattern] |
| Upgrade/reinstall | Run install twice, then `bash reinstall.sh --target codex` with same isolated variables | Existing settings/other-host state preserved; final doctor succeeds; no duplicate registration or destructive fallback. [VERIFIED: README/installers; exact repeated-install criterion [ASSUMED]] |
| Host-specific uninstall | `bash uninstall.sh --target codex` then `--target claude` in isolated fixture | Removing one host preserves shared runtime and other host skill; removing last selected host removes only owned state. [VERIFIED: test/shell-lifecycle.test.js, README.md] |
| Full uninstall | `bash uninstall.sh --target all` | Selected registrations, skills, runtime/config are absent or intentionally retained by `--keep-skill`; no outside-isolation deletion. [VERIFIED: uninstall.sh; final absence matrix [ASSUMED]] |
| Configuration scope | Set `XDG_CONFIG_HOME="$TMP/config"`, inspect only `$TMP/config/askuserquestionspro`; use isolated `HOME` for host settings | No writes to real `~/.claude`, `~/.agents`, `~/.config`, or live install directory. [VERIFIED: README.md, installers] |
| No destructive fallback | Use missing host binaries/blocked opener/invalid source and verify nonzero/actionable failure plus preserved prior state | Installer must not delete live runtime or silently claim success; unavailable tools become explicit environment gaps. [VERIFIED: install.sh, docs/testing.md; failure assertions [ASSUMED]] |

Run the existing deterministic shell lifecycle test as part of the matrix; it already proves Codex-only uninstall preserves the shared runtime, Claude skill, and listening bridge while removing Codex skill state. [VERIFIED: test/shell-lifecycle.test.js]

## External Evidence Fail-Closed Policy

`PASS` means the cited local command or retained artifact directly proves the row. `PARTIAL` means local contracts pass but an independent runtime lane remains open. `UNAVAILABLE` means the required environment/evidence is absent; it is not a failure count and never promotes compatibility. [VERIFIED: docs/evidence/v1.1.1-release-handoff.md, Phase 16 UAT summary]

Keep these lanes `UNAVAILABLE` unless owner-supplied evidence is attached: authenticated Claude Code, authenticated Codex, native Windows, native Linux, full browser runtime/AT, private-mode quota, origin/port drift, opener/profile failure, and ownership-denied close. Fake hosts, MCP tests, source contracts, macOS-only runs, and browser CLI smoke are not equivalent substitutions. [VERIFIED: Phase 15 evidence, Phase 17 security summary, handoff]

Each external row must include owner, environment, reason, next evidence/command, date, and scope. A missing row, vague “not tested,” or promotion based on omission is a release blocker. [VERIFIED: Phase 16 matrix schema and Phase 18 handoff schema; blocker rule [ASSUMED] from roadmap success criterion]

## User Dirty-File and Protected-Path Handling

The working copy contains user-owned dirty planning metadata, protected `.planning/config.json` and `.planning/ui-reviews/.gitignore`, untracked Phase 16/18 artifacts, and `.playwright-cli` output. Do not stage, amend, format, clean, delete, or normalize them. [VERIFIED: local git status and Phase 18 summary]

The final release evidence should reference the isolated clean candidate and separately record the dirty-workspace snapshot. If evidence is generated in the current workspace, capture baseline hashes/status first and assert protected paths are byte-identical and not newly staged; do not use the current workspace’s known Phase 18 bounded `git diff --check` deviation as clean-checkout release proof. [VERIFIED: Phase 18 validator/summary; isolated-release recommendation [ASSUMED]]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Package contents | Custom file crawler as sole proof | `npm pack --dry-run --json` plus package-boundary tests | npm’s pack calculation is the publish boundary. [VERIFIED: package.json, Phase 14 verification] |
| Dependency risk | Audit only dev tree or hand-count packages | `npm audit --omit=dev --audit-level=high` plus lockfile-root assertion | Matches zero-production-dependency policy and CI. [VERIFIED: CI, Phase 17 runner] |
| Installer cleanup | Broad `rm -rf` against operator paths | Existing target-aware scripts with isolated HOME/XDG and lifecycle tests | Host-specific uninstall preserves shared state by design. [VERIFIED: uninstall.sh, shell lifecycle test] |
| External compatibility | Infer host support from fake-host/protocol tests | Explicit `UNAVAILABLE` handoff rows until authenticated/native evidence | Project policy is evidence-gated. [VERIFIED: STATE.md, handoff, Phase 17] |
| Workflow parsing | Replace workflow tests with visual inspection | Existing workflow contract tests and exact SHA assertions | They encode supply-chain and CI/release invariants. [VERIFIED: workflow test files] |

## Common Pitfalls

### Treating the dirty workspace as the release candidate
**What goes wrong:** User planning edits or generated browser artifacts contaminate package, diff, or evidence results. **How to avoid:** isolate the exact candidate commit and preserve current dirty state read-only. **Warning sign:** `git status` is non-empty before the release run. [VERIFIED: current git state; isolation rule [ASSUMED]]

### Calling package version v1.1.1 while manifest remains 1.1.0
**What goes wrong:** npm publication/tag/changeset state can target a different version than the handoff. **How to avoid:** make version resolution an explicit checkpoint before Ready. **Warning sign:** `package.json.version` differs from release title/handoff. [VERIFIED: local files]

### Converting unavailable tools into success
**What goes wrong:** Missing ShellCheck, browser package, native OS, or authenticated host is silently treated as pass. **How to avoid:** record `UNAVAILABLE` with owner/environment/next command and keep it outside promotion evidence. [VERIFIED: docs/testing.md, Phase 15/17 evidence]

### Running only `npm test`
**What goes wrong:** packaging, audit, shell, workflow, documentation, and preservation gates remain untested. **How to avoid:** run the exact combined sequence and retain each label/status. [VERIFIED: roadmap, Phase 17 runner, Phase 18 validator]

### Using `git diff --check` on known dirty evidence
**What goes wrong:** A pre-existing trailing-space finding is mistaken for a new release defect or “fixed” by editing protected evidence. **How to avoid:** clean checkout for final gate; if current workspace is inspected, report the bounded pre-existing finding separately. [VERIFIED: Phase 18 summary/validation]

## Code Examples

### Isolated shell fixture pattern

```bash
TMP=$(mktemp -d)
HOME="$TMP/home" XDG_CONFIG_HOME="$TMP/config" \
  ASKUSER_SOURCE_DIR="$CANDIDATE" ASKUSER_TARGET=codex \
  bash install.sh --target codex
HOME="$TMP/home" XDG_CONFIG_HOME="$TMP/config" \
  ASKUSER_TARGET=codex bash uninstall.sh --target codex
rm -rf "$TMP"
```

Use only in a disposable fixture; never substitute the operator’s real HOME or live install path. [VERIFIED: installer variables/guards; disposable-fixture safety recommendation [ASSUMED]]

### Evidence row shape

```text
label: production-dependency-audit
command: npm audit --audit-level=high --omit=dev
status: PASS | BLOCKED | UNAVAILABLE
date: 2026-07-18
scope: clean candidate commit <sha>
interpretation: direct local result; no external-host promotion
```

The Phase 17 runner’s `LABEL`, command, status, summary, and interpretation shape is the established local precedent; external rows additionally require owner, environment, reason, and next evidence command. [VERIFIED: 17-run-audit.sh, 18-VALIDATION.md]

## State of the Art

| Older approach | Current approach | Impact |
|---|---|---|
| Treat archived historical counts as current | Use dated Phase 14–18 snapshots and rerun final gates | Prevents stale counts from becoming release proof. [VERIFIED: STATE.md, handoff] |
| Infer host support from protocol similarity | Require authenticated/native owner evidence | Keeps compatibility claims fail-closed. [VERIFIED: REQUIREMENTS.md, handoff] |
| Run release checks in a dirty workspace | Execute from exact clean candidate checkout | Makes package and diff results reproducible. [VERIFIED: roadmap goal; clean-checkout requirement [ASSUMED] implementation detail] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | A fresh temporary clone/worktree can be used without altering the current workspace. | Clean-checkout strategy | Release proof may be contaminated or require operator setup. |
| A2 | A version mismatch between manifest 1.1.0 and v1.1.1 release naming is a blocker until resolved. | Package/release gates | Wrong npm version/tag could be published. |
| A3 | Final package payload should be identical before/after lifecycle tests. | Reproducibility | Lifecycle may mutate candidate files or generated package metadata. |
| A4 | Failed installer fixtures must preserve prior state and return actionable failure. | Installer matrix | A destructive fallback could damage user installations. |
| A5 | Missing external evidence blocks a READY decision for claims requiring that evidence, while REL-03 can pass by documenting it as unavailable. | External policy | Ship decision semantics may need explicit product-owner confirmation. |
| A6 | `rm -rf "$TMP"` is safe only when `$TMP` is an explicitly created disposable directory. | Code example | Mis-scoped cleanup could delete user data. |

## Open Questions

1. **What exact commit/version is the v1.1.1 release candidate? — RESOLVED: OPEN RELEASE BLOCKER.** `package.json` remains `1.1.0` while the milestone/evidence names v1.1.1. Phase 19 must record the mismatch and stop at `BLOCKED`; it must not silently edit or publish a version, create a changeset, tag, or release commit. An explicit release-owner decision is required before any versioning operation. [VERIFIED: package.json and milestone docs]
2. **Are external unavailable lanes a blocker to publication or only a blocker to compatibility promotion? — RESOLVED: FAIL-CLOSED HANDOFF.** Authenticated Claude, authenticated Codex, native Windows, native Linux, and other unavailable lanes remain `UNAVAILABLE` owner handoffs. They cannot be counted as local PASS or used to promote compatibility. Phase 19 may document the handoff contract, but it must not invent publication authorization or convert absence of evidence into READY. [VERIFIED: REQUIREMENTS.md and handoff policy]
3. **Which supported macOS installer targets must be run manually beyond the deterministic fake-host tests? — RESOLVED: BOUNDED LOCAL SCOPE.** The manual macOS lane is exactly the locally executable macOS shell/installer lifecycle against disposable HOME/XDG fixtures, explicit `ASKUSER_SOURCE_DIR`, fake Claude/Codex binaries, and codex/claude/all target paths where the fixture supports them, plus the existing deterministic lifecycle tests. It may verify filesystem/config scope and fail-closed behavior only. It must not claim authenticated Claude/Codex compatibility, native host behavior, native Linux/Windows behavior, or publication readiness; those remain external handoffs. [VERIFIED: installers, docs/maintenance.md, and handoff]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---:|---|---|
| Node.js | all runtime/test gates | ✓ | 22.23.1 | CI Node 18/20 matrix evidence |
| npm | install/audit/pack/release checks | ✓ | 10.9.8 | none required |
| ShellCheck | shell gate | ✓ | 0.11.0 | If absent elsewhere, record UNAVAILABLE; do not install in gate |
| jq | installer tests/inspection | ✓ | local command present | Tests should use Node fallback where possible |
| Authenticated Claude Code | external host lane | ✗ | — | owner-supplied handoff |
| Authenticated Codex | external host lane | ✗ | — | owner-supplied handoff |
| Native Windows/Linux | external platform lanes | ✗ | — | owner-supplied handoff |

Availability is from this macOS workspace on 2026-07-18; CI and owner environments are separate evidence sources. [VERIFIED: local probes, STATE.md, Phase 17 summary]

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Native `node:test` via Node >=18 |
| Config | `package.json`, `eslint.config.js`, `.prettierrc.json`, `.github/workflows/*.yml` |
| Quick run | `node --test test/release-gates.test.js test/workflows-ci.test.js test/workflows-release.test.js test/host-install-gates.test.js test/shell-lifecycle.test.js` |
| Full suite | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| REL-01 | Combined package/audit/shell/workflow gates | integration | exact local gate sequence above | Existing tests plus Phase 19 evidence artifact |
| REL-02 | Isolated install/upgrade/uninstall/config scope/no-destructive fallback | integration/manual fixture | focused lifecycle command plus temporary HOME/XDG matrix | `test/shell-lifecycle.test.js` exists; final matrix evidence is Wave 0 output |
| REL-03 | External lanes remain unavailable and unpromoted | contract/evidence | `node --test test/host-evidence-matrix.test.js test/host-install-gates.test.js` | Existing |

### Sampling Rate

- Per task: focused release tests and `bash -n`.
- Per wave: exact package/audit/shell/workflow sequence.
- Phase gate: clean-checkout sequence, Phase 17 audit, Phase 18 validator, and explicit Ready/Blocked decision.

### Wave 0 Gaps

- [ ] Final Phase 19 evidence/checklist artifact with command/status/date/scope for every local gate.
- [ ] Isolated installer lifecycle matrix covering clean install, repeat upgrade, target-specific uninstall, full uninstall, config scope, and failure preservation.
- [ ] Version/changeset reconciliation for package `1.1.0` versus v1.1.1 target.
- [ ] Clean-checkout reproducibility transcript; current workspace must not be used as its substitute.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | No for local unauthenticated single-user bridge; external host auth lanes remain separate | Do not claim authenticated-host evidence locally. [VERIFIED: project constraints/handoff] |
| V3 Session Management | Yes | Preserve round identity, stale-operation guards, bounded recovery, and delivery acknowledgement tests. [VERIFIED: architecture/Phase 17] |
| V4 Access Control | Yes | Preserve target-scoped installer ownership and fail-closed host promotion. [VERIFIED: installers/Phase 17] |
| V5 Input Validation | Yes | Keep boundary validation and malformed/future settings rejection tests. [VERIFIED: architecture/Phase 17] |
| V6 Cryptography | No new cryptography in release gates | Do not invent signing/crypto behavior; package/workflow provenance remains the configured release control. [VERIFIED: release workflow; no-new-crypto claim [ASSUMED]] |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Remote bridge exposure | Elevation/Tampering | Verify loopback `127.0.0.1`; never widen bind during tests. [VERIFIED: project constraints/Phase 17] |
| Installer path overreach | Tampering/Denial | Isolated HOME/XDG, source/install path guards, target-aware lifecycle tests. [VERIFIED: installers/tests] |
| Malicious/unexpected package payload | Tampering | `npm pack --dry-run`, file allowlist, zero production dependency assertion. [VERIFIED: package tests] |
| Unsupported host promotion | Spoofing/Information | Preserve `UNAVAILABLE`, owner/environment/next-command fields, and fail-closed promotion tests. [VERIFIED: handoff/Phase 17] |

## Sources

### Primary (HIGH confidence)

- `PROJECT.md` / `AGENTS.md` project constraints and workflow rules. [CITED: local project instructions]
- `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`. [VERIFIED: local repository files]
- `package.json`, `package-lock.json`, `.github/workflows/ci.yml`, `.github/workflows/release.yml`. [VERIFIED: local repository files]
- Phase 14–18 summaries, verification, validation, evidence, `17-run-audit.sh`, and `18-validate.mjs`. [VERIFIED: local repository files]
- `docs/testing.md`, `docs/maintenance.md`, `docs/evidence/v1.1.1-release-handoff.md`, installers, and focused tests. [VERIFIED: local repository files]

### Secondary (MEDIUM confidence)

- Local tool probes: Node 22.23.1, npm 10.9.8, ShellCheck 0.11.0, jq available. [VERIFIED: local command output]

### Tertiary (LOW confidence)

- None used for release claims; assumptions are explicitly listed above. [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — manifest, workflows, and local tool probes.
- Architecture: HIGH — package/install/evidence contracts are present and tested.
- Pitfalls: HIGH for observed dirty/evidence/version issues; MEDIUM for recommended isolation mechanics.

**Research date:** 2026-07-18
**Valid until:** 2026-07-25 for release workflow/tool versions; repository-local contracts remain valid until changed.
