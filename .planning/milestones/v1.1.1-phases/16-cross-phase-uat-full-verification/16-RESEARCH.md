# Phase 16: Cross-Phase UAT & Full Verification - Research

**Researched:** 2026-07-18
**Domain:** Cross-phase release verification, UAT reconciliation, Node/browser/host evidence
**Confidence:** HIGH

## Summary

Phase 16 is an evidence-reconciliation and verification phase, not a source-feature phase. The six archived UAT reports for Phases 8–13 all report `partial`, but their repeated automated claims are now superseded by Phase 14/15 and the current checkout: the former missing local ESLint/Prettier tools are installed and pass, and the current full suite is 505 passing with one expected Playwright-package skip. [VERIFIED: codebase grep] [VERIFIED: command]

The correct release statement is “all locally executable gates pass; external/runtime lanes remain explicitly unavailable.” Do not convert contract tests, fake hosts, Browser-skill observations, CI configuration, or historical macOS evidence into authenticated Claude/Codex or native OS support claims. [VERIFIED: codebase grep]

**Primary recommendation:** Create one dated UAT matrix whose row status is `PASS`, `PARTIAL`, or `UNAVAILABLE`, attach each row to current commands/artifacts, rerun the release-critical suites, and preserve the exact external handoff list.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UAT-01 | Archived phases 8–13 have reconciled UAT records with current command results, zero diagnosed application issues, and explicit external limitations. | Six archived UAT reports, Phase 14/15 verification, v1.1 integration check, and current command results define the reconciliation matrix and stale-claim corrections. |
| UAT-02 | The full workspace suite and each release-critical focused suite pass after hardening changes. | Current `npm test`, lint, format, browser smoke, audit, package, shell, and 179-test focused command results define the executable gate set. |
</table>
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| UAT evidence and status reconciliation | Repository artifacts / release process | CI | Reports, matrices, and command logs own claims; CI is an execution handoff for matrix environments. [VERIFIED: codebase grep] |
| Full automated verification | Node test/runtime | Browser/CI | `node:test` owns repository regression tests; browser CLI and CI provide boundary/matrix evidence. [VERIFIED: package.json] [VERIFIED: codebase grep] |
| Host ask through answer delivery | API/backend bridge | Browser and host adapters | `server/bridge.js`/`server/server.js` own lifecycle and durable identity; browser and adapters consume the contracts. [VERIFIED: codebase grep] |
| Native/authenticated acceptance | External host/OS environment | Repository evidence ledger | It cannot be proven by local fake-host, protocol, or source-contract tests. [VERIFIED: codebase grep] |

## User Constraints

- Do not modify source files; this research artifact is the only requested write. [VERIFIED: user request]
- Preserve zero production dependencies, Node.js 18+ compatibility, localhost-only binding, Claude/Codex compatibility, and honest evidence boundaries. [CITED: .planning/PROJECT.md]
- Phase 16 must reconcile UAT-01/UAT-02 without diagnosing an untracked application issue. [CITED: .planning/ROADMAP.md]

## Reconciled UAT Matrix

Use this as the canonical matrix in the implementation plan. `PASS` means current executable/local evidence exists; `PARTIAL` means the local portion passes but a required runtime lane is open; `UNAVAILABLE` means the environment cannot execute the lane and no pass claim is allowed. [VERIFIED: codebase grep]

| Row | Current status | Evidence to link/rerun | Reconciliation / exact gap |
|---|---|---|---|
| Phase 08 lifecycle, ownership, races, detach/resume, deadlines | PASS (local) / PARTIAL (host) | `test/round-lifecycle.test.js`, `test/bridge.test.js`, `test/long-round.test.js`; `08-UAT.md`, `08-VERIFICATION.md` | Archived 117 focused passes remain consistent. Authenticated Claude evidence and version-scoped live Codex evidence are not local claims. [VERIFIED: codebase grep] |
| Phase 09 durable store, restart, corruption, exact recovery, ack, migration | PASS (local) / PARTIAL (OS) | `test/round-record.test.js`, `test/round-store.test.js`, `test/bridge.test.js`, `test/bridge-client.test.js`; `09-UAT.md` | Archived 86 + 117 + 13 focused claims are consistent in behavior; native Linux/Windows permission/installer execution remains unavailable. [VERIFIED: codebase grep] |
| Phase 10 settings v2 and browser settings | PASS (local) / PARTIAL (visual/AT/host) | `test/settings*.test.js`, `test/runtime-settings.test.js`, `test/browser-settings*.js`, `npm run test:browser`; `10-UAT.md` | Ten UAT rows passed. “Screenshots not materialized” and missing lint/format are stale for the current phase: Phase 15 retains screenshots and current tools pass. AT, authenticated hosts, and cross-platform lanes remain open. [VERIFIED: codebase grep] [VERIFIED: command] |
| Phase 11 recovery, reconciliation, delivery, focus | PASS (contract/local) / PARTIAL (runtime browser/AT) | `test/live.test.js`, `test/draft-writer.test.js`, `test/app-state.test.js`, `test/views-a11y*.test.js`, `11-UAT.md`, Phase 15 evidence | Archived 8-pass/1-skipped matrix remains directionally correct. Current browser evidence improves settings/waiting/recovery observations, but delivery close denial, failure injection, focus trace, screen reader, quota, origin drift, and opener failure remain unavailable. [VERIFIED: codebase grep] |
| Phase 12 adapter contract, fake host, MCP, installer, Tier 1 | PASS (local) / PARTIAL (authenticated host) | `test/adapter-contract.test.js`, `test/fake-host-conformance.test.js`, `test/mcp-long-round.test.js`, `test/cli-adapters.test.js`, `test/install.test.js`, `test/tier1-acceptance.test.js` | Archived local groups are consistent. Authenticated Claude/Codex acceptance is unavailable and must not be promoted from fake-host/MCP evidence. [VERIFIED: codebase grep] |
| Phase 13 host ledger, research integrity, OS/release gates | PASS (local evidence machinery) / PARTIAL (native/authenticated promotion) | `test/host-evidence-matrix.test.js`, `test/host-research-integrity.test.js`, `test/native-os-evidence.test.js`, `test/cross-platform-evidence.test.js`, `test/release-gates.test.js` | Archived 59 phase tests + 9 checkpoints remain consistent. Native Linux/Windows and authenticated expansion-host runs are unavailable; candidate promotion remains fail-closed. [VERIFIED: codebase grep] |
| Cross-phase wiring: ask → durable registration → browser → recovery → answer → ack → adapter | PASS (local) / PARTIAL (real host/browser ownership) | `.planning/milestones/v1.1-INTEGRATION-CHECK.md`; focused command below | Integration check says no critical blockers; old Phase 11 disconnected-panel table is stale documentation, not a code defect. [VERIFIED: codebase grep] |
| Static/reproducibility gates after Phase 14 | PASS | `npm run lint`, `npm run format:check`, `test/eslint-prettier-config.test.js`, `test/package-boundary.test.js`, `14-VERIFICATION.md` | Replace every archived “eslint/prettier unavailable” statement with current passing evidence. [VERIFIED: command] [VERIFIED: codebase grep] |
| Browser visual/accessibility QA after Phase 15 | PASS (artifacts/contracts) / PARTIAL (runtime/AT) | `15-UI-EVIDENCE.md`, `15-BROWSER-EVIDENCE.md`, `15-VERIFICATION.md`; retained PNGs | Do not call UI-02 fully runtime-proven: delivery/close/retry and focus traces remain behavior-unverified; AT and failure-injection lanes are unavailable. [VERIFIED: codebase grep] |

## Standard Stack

| Tool | Version/status | Purpose |
|---|---|---|
| Node.js built-in `node:test` | Node v22.23.1 local; project requires Node >=18 | Full and focused regression suites. [VERIFIED: command] [CITED: package.json] |
| npm | 10.9.8 local | Scripts, audit, pack, clean-install workflow. [VERIFIED: command] |
| ESLint | Repository dev tool; `npm run lint` exit 0 | Static quality. [VERIFIED: command] |
| Prettier | Repository dev tool; `npm run format:check` exit 0 | Maintained formatting scope. [VERIFIED: command] |
| ShellCheck | `/opt/homebrew/bin/shellcheck`; warning gate passes | Installer script validation. [VERIFIED: command] |
| Browser CLI smoke | `npm run test:browser` exit 0 | Supplementary settings/browser smoke; not full browser UAT. [VERIFIED: command] |
| GitHub Actions | Node 18/20/22 test matrix; Ubuntu lint job | CI handoff for unavailable native runtime lanes. [CITED: .github/workflows/ci.yml] |

No external package installation is required for Phase 16; therefore a package legitimacy audit is not applicable. [VERIFIED: package.json]

## Architecture Patterns

### Verification flow

```text
Archived UAT/verification reports
        ↓ reconcile against current files and commands
Current full suite (node:test) ──┐
Focused lifecycle/recovery/UI/adapter/release suites ─┼→ Canonical UAT matrix
Lint + format + browser smoke + audit + pack + shell ─┘       ↓
                                                   PASS / PARTIAL / UNAVAILABLE
                                                            ↓
                                    Exact external handoff; no support promotion
```

### Required execution order

1. Capture clean-checkout identity and environment (`node --version`, `npm --version`, `git status`). [VERIFIED: command]
2. Run `npm test`; record the final TAP counts, including the one expected Playwright-package skip. [VERIFIED: command]
3. Run the release-critical focused command listed in Validation Architecture; it currently passes 179/179 with no skips. [VERIFIED: command]
4. Run lint, format, browser smoke, audit, package dry-run, Bash syntax, and ShellCheck. [VERIFIED: command]
5. Reconcile every archived report row against current results; mark stale historical claims as superseded rather than silently editing history. [ASSUMED]
6. Record external handoffs separately from local results and retain “no diagnosed application issue” only for the exercised local surface. [CITED: .planning/milestones/v1.1-INTEGRATION-CHECK.md]

### Anti-patterns to avoid

- **Aggregating historical pass counts as current totals:** archived reports say 500 full-suite passes; current checkout says 505 passes. Use the current run as authoritative. [VERIFIED: command]
- **Treating `partial` as failure or as full release pass:** it means local evidence passed while named external lanes remain open. [VERIFIED: codebase grep]
- **Calling fake-host/MCP/source contracts authenticated host evidence:** the artifacts explicitly distinguish these lanes. [VERIFIED: codebase grep]
- **Calling Browser-skill observations a reproducible full browser run:** Phase 15 explicitly says the optional Playwright Node package is skipped and several runtime scenarios are unavailable. [VERIFIED: codebase grep]
- **Reopening the fixed `/resume` route mismatch:** current integration evidence and tests show `POST /resume` with `{ roundId }`; the old mismatch is historical. [VERIFIED: codebase grep]

## Don't Hand-Roll

| Problem | Don't build | Use instead |
|---|---|---|
| Test aggregation | A custom counter or duplicate test runner | Node TAP summary from `npm test` and focused `node --test` commands. [VERIFIED: package.json] |
| Evidence status | Ad hoc prose-only host claims | Existing redacted ledger/matrix/card validators and dated evidence artifacts. [VERIFIED: codebase grep] |
| Browser/AT proof | A source-contract test presented as runtime UAT | Retained Phase 15 artifacts for local observations plus explicit human/external handoff rows. [VERIFIED: codebase grep] |
| Cross-platform proof | WSL/emulation/protocol similarity as native evidence | Native OS runs in the structured evidence matrix; keep unavailable rows unavailable. [VERIFIED: codebase grep] |

## Common Pitfalls

### Stale tool-gap claims

Archived Phases 8–13 repeatedly say ESLint and Prettier were unavailable. Phase 14 verification proves both commands now pass, so Phase 16 must annotate those historical claims as superseded, not retain them as current gaps. [VERIFIED: codebase grep] [VERIFIED: command]

### Count drift

The archived full-suite baseline is 500 pass / 1 skip; the current run is 505 pass / 1 skip across 506 tests. Counts are evidence snapshots, not contradictions in behavior. [VERIFIED: codebase grep] [VERIFIED: command]

### Unsupported platform promotion

The repository explicitly records Linux and Windows native lanes as `Unavailable`, and authenticated Claude/Codex rows as unavailable. The plan should create handoff records, not install hosts or infer support. [VERIFIED: codebase grep]

### Browser evidence overclaim

Current screenshots cover settings, mobile settings, and waiting/recovery metadata; they do not prove denied `window.close()`, uncertain acknowledgement failure injection, screen-reader output, quota pressure, origin drift, or opener/profile failure. [VERIFIED: codebase grep]

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Node.js built-in `node:test` under Node v22.23.1 locally; project baseline Node >=18. [VERIFIED: command] [CITED: package.json] |
| Config file | None; discovery is through `package.json` script and `test/*.test.js`. [VERIFIED: package.json] |
| Quick run command | `node --test test/live.test.js test/draft-writer.test.js test/app-state.test.js test/views-a11y-recovery.test.js` [VERIFIED: codebase grep] |
| Full suite command | `npm test` [VERIFIED: package.json] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test type | Automated command | File exists? |
|---|---|---|---|---|
| UAT-01 | Six archived reports agree with current results and explicit limitations | integration/evidence audit | `npm test`; inspect six `*-UAT.md`, six verification reports, v1.1 integration check, Phase 14/15 evidence | ✅ |
| UAT-02 | Full workspace regression remains green | integration | `npm test` → 505 pass, 1 expected skip | ✅ |
| UAT-02 | Lifecycle, durable recovery, browser delivery, adapter, and release gates remain green | focused integration | The 179-test command below → 179 pass, 0 fail, 0 skip | ✅ |
| UAT-02 | Static/package/release commands remain green | release smoke | `npm run lint && npm run format:check && npm run test:browser && npm audit --audit-level=high --omit=dev && npm pack --dry-run --json && bash -n install.sh uninstall.sh reinstall.sh && shellcheck --severity=warning install.sh uninstall.sh reinstall.sh` | ✅ |

**Release-critical focused command:**

```bash
node --test \
  test/round-lifecycle.test.js test/round-state.test.js test/round-record.test.js test/round-store.test.js \
  test/bridge.test.js test/bridge-client.test.js test/long-round.test.js test/mcp-long-round.test.js test/mcp-progress.test.js \
  test/fake-host-conformance.test.js test/adapter-contract.test.js test/tier1-acceptance.test.js \
  test/cli-adapters.test.js test/install.test.js test/native-os-evidence.test.js test/cross-platform-evidence.test.js \
  test/host-evidence-matrix.test.js test/host-research-integrity.test.js test/host-install-gates.test.js \
  test/release-gates.test.js test/package-boundary.test.js test/docs-integrity.test.js test/changesets-config.test.js \
  test/workflows-ci.test.js test/workflows-release.test.js test/browser-recovery-e2e.test.js \
  test/views-a11y.test.js test/views-a11y-recovery.test.js test/live.test.js test/draft-writer.test.js test/app-state.test.js
```

### Sampling Rate

- Per reconciliation task: rerun the affected focused file(s). [ASSUMED]
- Per wave: run the 179-test focused command. [VERIFIED: command]
- Phase gate: run `npm test` plus all release smoke commands; require zero failures and only the documented Playwright-package skip. [VERIFIED: command]

### Wave 0 Gaps

- No new automated test framework gap is identified; current tests cover the local phase surface. [VERIFIED: codebase grep]
- Human/external evidence remains a handoff gap, not a missing unit-test fixture: authenticated Claude/Codex, native Linux/Windows, screen readers, private quota, origin drift, opener/profile failure, denied close, and runtime delivery failure injection. [VERIFIED: codebase grep]

## Security Domain

| ASVS category | Applies | Verification implication |
|---|---|---|
| V2 Authentication | No product authentication; local single-user model | Do not expose or claim remote support; preserve loopback-only boundary. [CITED: .planning/PROJECT.md] |
| V3 Session Management | Yes | Keep opaque round/capability identity, exact recovery selection, stale-owner guards, and acknowledgement identity in focused tests. [VERIFIED: codebase grep] |
| V4 Access Control | Yes | Verify request/round ownership and fail-closed host evidence promotion. [VERIFIED: codebase grep] |
| V5 Input Validation | Yes | Preserve boundary validation and evidence/ledger integrity tests. [VERIFIED: codebase grep] |
| V6 Cryptography | No new cryptographic feature in this phase | Do not invent a crypto gate for UAT reconciliation. [ASSUMED] |

## Exact Remaining Human / External Gaps

1. Authenticated Claude Code and Codex end-to-end runs, including version-pinned long-round delivery and recovery, remain unavailable. [VERIFIED: codebase grep]
2. Native Linux and Windows durability/installer runs remain unavailable; WSL/emulation does not close the native evidence row. [VERIFIED: codebase grep]
3. Authenticated expansion-host validation remains unavailable; no candidate should be promoted beyond its ledger status. [VERIFIED: codebase grep]
4. Real browser ownership-denied `window.close()`, uncertain acknowledgement failure injection, and opener/profile failure remain unavailable. [VERIFIED: codebase grep]
5. VoiceOver/NVDA/JAWS or equivalent screen-reader output remains unavailable; ARIA/source tests are not AT execution. [VERIFIED: codebase grep]
6. Private-mode/storage-quota pressure and localhost origin/port drift remain unavailable. [VERIFIED: codebase grep]
7. Node 18 and Node 20 are CI matrix handoffs rather than local execution evidence in this macOS workspace. [CITED: .planning/phases/14-static-quality-reproducibility/14-VERIFICATION.md]

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | Archived reports should remain historical records while the Phase 16 matrix marks superseded claims explicitly. | Architecture Patterns | Planner could overwrite provenance and lose auditability. |
| A2 | A focused command that passes all release-critical test files is sufficient for UAT-02’s focused-suite gate when combined with `npm test`. | Validation Architecture | A missing release-critical file would create false confidence; planner should preserve the listed file inventory. |
| A3 | V6 has no new Phase 16-specific applicability beyond existing product controls. | Security Domain | Phase 17 may identify a separate cryptographic concern. |

## Open Questions Resolved from Repository Evidence

| Question | Resolution |
|---|---|
| Are the repeated 500-pass UAT counts current? | No. They are historical snapshots; current `npm test` is 505 pass, 1 skip, 0 fail. [VERIFIED: command] |
| Did Phase 14 close the old lint/format gap? | Yes. Both commands exit 0; old UAT gap text is stale for current status. [VERIFIED: command] |
| Is exact recovery still blocked by the old route mismatch? | No. The integration check records the fix to `POST /resume` with `{ roundId }`, and focused tests pass. [VERIFIED: codebase grep] |
| Does Phase 15 prove all browser behavior? | No. It proves retained local artifacts/contracts and explicitly leaves runtime close/retry/focus/AT/failure-injection lanes unavailable. [VERIFIED: codebase grep] |
| Are there diagnosed application issues hidden in the reports? | No local application issue is reported by the six UAT files, integration check, or current automated gates; report/documentation drift is tracked separately. [VERIFIED: codebase grep] |

## Sources

### Primary (HIGH confidence)

- `.planning/milestones/v1.1-phases/08..13/*-UAT.md` and `*-VERIFICATION.md` — archived UAT claims and limitations. [VERIFIED: codebase grep]
- `.planning/phases/14-static-quality-reproducibility/14-VERIFICATION.md` and `14-QUAL-03-EVIDENCE.md` — current static/reproducibility evidence. [VERIFIED: codebase grep]
- `.planning/phases/15-browser-visual-accessibility-qa/15-VERIFICATION.md`, `15-UI-EVIDENCE.md`, `15-BROWSER-EVIDENCE.md` — current browser evidence boundary. [VERIFIED: codebase grep]
- `.planning/milestones/v1.1-INTEGRATION-CHECK.md` — cross-phase wiring and resolved route mismatch. [VERIFIED: codebase grep]
- `package.json`, `.github/workflows/ci.yml`, `test/` — commands, test layout, and CI matrix. [VERIFIED: codebase grep]
- Current command execution on 2026-07-18 — full suite, focused suite, lint, format, browser smoke, audit, pack, Bash, ShellCheck. [VERIFIED: command]

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---:|---|---|
| Node.js | Full/focused tests | ✓ | v22.23.1 | CI Node 18/20/22 matrix for baseline coverage |
| npm | Scripts/audit/pack | ✓ | 10.9.8 | — |
| ESLint | Static gate | ✓ | repository-installed | — |
| Prettier | Format gate | ✓ | repository-installed | — |
| ShellCheck | Installer gate | ✓ | `/opt/homebrew/bin/shellcheck` | — |
| Playwright Node package | Full browser runtime | ✗/optional | expected test skip | Browser CLI smoke and explicit unavailable rows; not equivalent to full browser UAT |
| Authenticated Claude/Codex | Live host UAT | ✗ | — | Human/external handoff |
| Native Linux/Windows | OS UAT | ✗ | — | Native-environment handoff |

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — package scripts, CI, and current commands were inspected/executed.
- Architecture: HIGH — current integration check and repository tests cover the boundaries.
- Pitfalls: HIGH — contradictions are directly visible in archived versus current evidence.
- External gap status: HIGH — Phase 15/13 artifacts explicitly classify unavailable lanes.

**Research date:** 2026-07-18
**Valid until:** 2026-07-25 for tool/test counts; external availability must be rechecked at execution time.

## RESEARCH COMPLETE
