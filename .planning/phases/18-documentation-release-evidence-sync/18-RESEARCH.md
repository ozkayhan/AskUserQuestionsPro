# Phase 18: Documentation & Release Evidence Sync - Research

**Researched:** 2026-07-18
**Domain:** Maintained documentation, evidence reconciliation, release handoff
**Confidence:** HIGH

## Summary

Phase 18 is a documentation/evidence synchronization phase, not a source or archive rewrite. The current checkout has local proof for the full test suite, focused UAT, lint, format, browser smoke, production audit, package dry-run, shell checks, redaction, fail-closed promotion, archive immutability, and protected-file preservation. [VERIFIED: codebase grep — `.planning/phases/16-cross-phase-uat-full-verification/16-VERIFICATION.md`, `16-UAT-SUMMARY.md`, `17-VERIFICATION.md`, and `17-SECURITY-SUMMARY.md`]

The maintained docs already describe the local-only architecture, zero production dependencies, Node 18+ support, Claude/Codex adapter distinction, recovery contract, and evidence-gated host support. The exact gaps are synchronization gaps: a stale Phase 11 reconciliation table is called out by the v1.1 integration check; Phase 16/17 verification records expose stale ROADMAP/STATE metadata; current release documentation does not yet provide one concise v1.1.1 handoff linking all final gates; and the v1.1 historical rationale is distributed across milestone audit, integration check, decisions, timeout runbook, host cards, and phase evidence. [VERIFIED: codebase grep — `v1.1-INTEGRATION-CHECK.md`, `16-VERIFICATION.md`, `17-VERIFICATION.md`, `docs/decisions.md`, `docs/timeout-runbook.md`, `README.md`, `docs/README.md`]

**Primary recommendation:** establish a single maintained release-evidence index/handoff, update only current docs and permitted planning metadata, preserve archived phase artifacts byte-for-byte, and make every status claim trace to a dated command/evidence artifact or an explicit external handoff.

## User Constraints

The phase has no `*-CONTEXT.md`; the following constraints are authoritative from project instructions and current planning artifacts. [VERIFIED: codebase grep — `AGENTS.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`]

- Preserve Claude Code and Codex integrations, Node.js 18+, localhost-only binding, zero production dependencies, current packaging, automated regression coverage, and honest external evidence boundaries. [VERIFIED: codebase grep — `AGENTS.md`, `.planning/PROJECT.md`]
- Do not edit source, archives, or protected dirty files. [VERIFIED: user instruction — current task]
- Do not blindly format historical artifacts; preserve historical rationale before cleanup. [VERIFIED: codebase grep — `.planning/REQUIREMENTS.md` Out of Scope]
- DOC-01 requires maintained docs to accurately describe lint/format policy, UAT status, release gates, and Windows/Claude evidence gaps. [VERIFIED: codebase grep — `.planning/REQUIREMENTS.md`]
- DOC-02 requires a concise reproducible v1.1.1 audit/UAT handoff for a future maintainer. [VERIFIED: codebase grep — `.planning/REQUIREMENTS.md`]

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOC-01 | Maintained docs accurately describe lint/format policy, UAT status, release gates, and known Windows/Claude evidence gaps. | Standard stack, exact gap inventory, source-of-truth policy, and redaction checks below. |
| DOC-02 | v1.1.1 audit and UAT artifacts provide a concise reproducible handoff for a future maintainer. | Evidence index, command links, historical rationale map, and external handoff template below. |

## Exact Documentation Gaps

| Gap | Evidence | Planned treatment |
|---|---|---|
| Phase 11 verification contains an older `ReconciliationPanel` disconnected-path table even though current app wiring and tests are connected. | [VERIFIED: codebase grep — `.planning/milestones/v1.1-INTEGRATION-CHECK.md` Documentation drift and WEB-05 rows] | Update the current maintained cross-reference or add a supersession note; do not edit the archived Phase 11 artifact unless explicitly allowed by the phase plan. |
| ROADMAP still has a historical `15 In Progress` progress row while Phase 15 evidence is complete but human-needed, and Phase 16/17 verification found stale duplicate requirement/status metadata. | [VERIFIED: codebase grep — `.planning/ROADMAP.md`, `16-VERIFICATION.md`, `17-VERIFICATION.md`] | Reconcile current planning metadata through the supported workflow; document exact before/after consistency checks. Preserve protected dirty files. |
| STATE and ROADMAP need a single current Phase 18 position and consistent completed-phase accounting after Phase 17. | [VERIFIED: codebase grep — `.planning/STATE.md`, `.planning/ROADMAP.md`, `17-VERIFICATION.md`] | Update only the intended planning metadata and validate phase/plan counts, current position, and requirement statuses. |
| Release evidence is spread across Phase 14–17 reports, browser evidence, security summary, package tests, CI workflow, and host cards; there is no concise current v1.1.1 maintainer index. | [VERIFIED: codebase grep — `.planning/phases/14-*`, `15-*`, `16-*`, `17-*`, `.github/workflows`, `docs/evidence`, `docs/README.md`] | Add or update one maintained release/evidence handoff with stable relative links, commands, dates, scope, and status vocabulary. |
| Current README/docs describe product contracts but do not provide a single final matrix linking lint, format, UAT, security, package, shell, browser, and external evidence. | [VERIFIED: codebase grep — `README.md`, `docs/README.md`, `docs/testing.md`, `docs/maintenance.md`] | Add an index or maintained release section; link to existing evidence rather than duplicating raw output. |
| v1.1 rationale is preserved but distributed and easy to lose during cleanup. | [VERIFIED: codebase grep — `.planning/milestones/v1.1-MILESTONE-AUDIT.md`, `.planning/milestones/v1.1-INTEGRATION-CHECK.md`, `docs/decisions.md`, `docs/timeout-runbook.md`] | Create a short historical-rationale section that links to the durable sources: durable recovery, explicit timeout ownership, evidence-gated host promotion, local-only/zero-dependency constraints, and the former `/resume` route mismatch fix. |

## Source-of-Truth Policy

Use this hierarchy in every maintained document and release handoff:

1. **Current implementation contract:** current source/tests and maintained docs (`server/`, `lib/`, `web/`, `hooks/`, `mcp-server/`, `docs/`). [VERIFIED: codebase grep — `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONVENTIONS.md`]
2. **Current executable evidence:** Phase 14–17 `VERIFICATION.md`, summaries, validation manifests, UAT matrix, UI evidence, and security summary; quote counts/status only from the dated artifact. [VERIFIED: codebase grep — phase artifacts]
3. **Release workflow authority:** `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `package.json`, lockfile, and changesets. [VERIFIED: codebase grep — repository files]
4. **Historical rationale:** milestone audit, integration check, decisions, and archived phase records; use as context and link it, not as current command evidence. [VERIFIED: codebase grep — milestone and archive paths]

If sources disagree, current code plus current executable evidence wins for behavior; a historical artifact remains unchanged and must be labeled historical/superseded. Never turn `PARTIAL`, `UNAVAILABLE`, `Researching`, or `Unsupported` into `PASS` by omission. [VERIFIED: codebase grep — host cards, UAT matrix, Phase 15/17 evidence]

## Evidence Link Matrix

| Evidence lane | Current source of truth | Status to expose |
|---|---|---|
| Full suite | `16-VERIFICATION.md` label `full-suite`; Phase 14 verification corroborates | PASS: 505 passed, 1 expected Playwright-package skip, 0 failures. [VERIFIED: codebase grep] |
| Release-focused suite | `16-VERIFICATION.md` label `focused-suite` | PASS: 179 passed, 0 skipped, 0 failures. [VERIFIED: codebase grep] |
| Lint/format | `16-VERIFICATION.md` labels `lint` and `format`; policy in `package.json`, `docs/tech-stack.md`, `docs/testing.md` | PASS locally in current evidence; CI remains the Node 20 lint/format execution lane. [VERIFIED: codebase grep] |
| Browser | `15-UI-EVIDENCE.md`, `15-BROWSER-EVIDENCE.md`, `15-VERIFICATION.md`, `16-VERIFICATION.md` | Separate source/contract/browser-smoke PASS from runtime delivery-close, focus-trace, AT, quota, origin, opener, and denied-close UNAVAILABLE/PARTIAL. [VERIFIED: codebase grep] |
| Security/privacy | `17-SECURITY-SUMMARY.md`, `17-VERIFICATION.md` | PASS for local gates; four external lanes remain UNAVAILABLE. [VERIFIED: codebase grep] |
| Package/dependencies | `16-VERIFICATION.md` labels `package-dry-run`, `audit`, `production-dependency-drift` | PASS; preserve zero production dependencies and package allowlist. [VERIFIED: codebase grep — `package.json`, verification report] |
| Shell/install | `16-VERIFICATION.md` labels `bash-syntax`, `shellcheck`; Phase 19 owns complete lifecycle release proof | PASS for current shell checks; do not imply full clean-install/upgrade/uninstall release completion before Phase 19. [VERIFIED: codebase grep — roadmap and verification] |
| External handoff | `17-SECURITY-SUMMARY.md`, host capability cards, `docs/evidence/phase-13-native-os-runs.*`, UAT matrix | UNAVAILABLE: authenticated Claude, authenticated Codex, native Windows, native Linux; owner/environment/next command required. [VERIFIED: codebase grep] |

## Architecture Patterns

### Documentation/evidence flow

```text
Current code + tests + package/CI definitions
        ↓
Phase 14 static/reproducibility evidence
        ↓
Phase 15 browser evidence ─┐
Phase 16 UAT matrix/full gates ├→ v1.1.1 maintained release handoff → Phase 19 ship gate
Phase 17 security/redaction ┘
        ↓
External handoff ledger (Claude/Codex/Windows/Linux) remains separate from local PASS
```

This is a documentation architecture: the handoff should link, classify, and summarize evidence; it should not copy payloads, credentials, screenshots without provenance, or raw command logs unnecessarily. [VERIFIED: codebase grep — phase summaries, redaction checks, project constraints]

### Recommended project structure

```text
docs/
├── README.md                 # maintained documentation index
├── testing.md                # commands and CI policy
├── maintenance.md            # operational/release maintenance
├── evidence/                 # bounded durable evidence and external handoffs
└── host-capability-cards/    # per-host evidence-gated status
.planning/phases/18-*/
└── 18-RESEARCH.md            # this planning input; not published runtime docs
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Test/release output | A second bespoke result ledger | Existing labeled Phase 16/17 verification manifests and validators | They already enforce exact labels, status, redaction, and fail-closed semantics. [VERIFIED: codebase grep] |
| Host support status | A prose-only support claim | Existing capability cards, UAT matrix, and promotion-fail-closed checks | Prevents protocol similarity or missing evidence from becoming support. [VERIFIED: codebase grep] |
| Historical rationale | A rewritten archive | Links plus a concise maintained summary | Archives are protected historical evidence and Phase 16 proved their immutability. [VERIFIED: codebase grep] |
| Sensitive evidence filtering | Ad hoc regex-only cleanup | Existing redacted projections/scans and bounded status/path/count schema | Phase 17 specifically verifies nested redaction and evidence-corpus privacy. [VERIFIED: codebase grep] |

## Common Pitfalls

### Contradictory duplicate metadata
**What goes wrong:** A completed phase appears Pending in a duplicate ROADMAP table or STATE remains on the previous phase. [VERIFIED: codebase grep — Phase 16/17 verification]
**How to avoid:** Run a consistency scan over ROADMAP, REQUIREMENTS, STATE, phase checklists, and verification frontmatter; check each requirement exactly once.

### Historical evidence treated as current
**What goes wrong:** Old test counts, missing-tool warnings, or pre-fix route descriptions are presented as the final status. [VERIFIED: codebase grep — milestone audit and integration check]
**How to avoid:** Label snapshots with date/status and link current Phase 14–17 evidence; never edit protected archives.

### External gaps silently promoted
**What goes wrong:** Fake-host, MCP, source-contract, or browser-smoke evidence is described as authenticated Claude/Codex, native Windows/Linux, full browser runtime, or AT proof. [VERIFIED: codebase grep — Phase 15/16/17 summaries]
**How to avoid:** Keep owner, environment, reason, next command, and expected evidence in each external row; retain `UNAVAILABLE` until supplied.

### Redaction drift
**What goes wrong:** New docs or copied logs include question/answer payloads, capabilities, request IDs with sensitive context, absolute home paths, credentials, or raw environment output. [VERIFIED: codebase grep — Phase 17 security report]
**How to avoid:** Use statuses, bounded counts, relative paths, dates, versions where safe, and existing redaction scans; inspect generated artifacts before commit.

### Formatting scope churn
**What goes wrong:** `prettier --write .` rewrites archives, generated/vendor files, or unrelated dirty content. [VERIFIED: codebase grep — Phase 14 summary and `package.json` format scope]
**How to avoid:** Use the explicit maintained roots from `package.json`; inspect `git diff --check` and protected/archive comparisons.

## Code Examples

The planner should reference existing evidence commands rather than invent new output formats:

```bash
npm test
npm run lint
npm run format:check
npm audit --audit-level=high --omit=dev
npm pack --dry-run --json
bash -n install.sh uninstall.sh reinstall.sh
shellcheck --severity=warning install.sh uninstall.sh reinstall.sh
```

These commands and their current results are recorded in Phase 16 verification labels; the release handoff must link those labels and state scope/date rather than claim a fresh run unless it actually runs one. [VERIFIED: codebase grep — `16-VERIFICATION.md`, `package.json`]

## Runtime State Inventory

Not a rename/refactor/migration phase. No runtime-state migration is required. The documentation work must still preserve the local settings/round-store privacy policy and must not copy stored question/answer payloads into evidence. [VERIFIED: codebase grep — `.planning/PROJECT.md`, `17-VERIFICATION.md`]

## Environment Availability

No new external dependency or package installation is required. The phase can use repository files, Node/npm scripts already declared, and existing evidence artifacts. Authenticated Claude/Codex sessions and native Windows/Linux environments are intentionally unavailable and must remain handoff rows, not blockers to documenting local evidence. [VERIFIED: codebase grep — `package.json`, Phase 17 external lanes]

## Validation Architecture

### Documentation consistency checks

| Requirement | Test type | Automated/manual check | Expected result |
|---|---|---|---|
| DOC-01 | repository consistency | Scan maintained docs for lint/format commands, UAT counts/status, release gate links, and Windows/Claude gap language | Each claim has a current source link and no external lane is promoted. |
| DOC-02 | evidence integrity | Validate every linked artifact exists; rerun Phase 16/17 validators where permitted; inspect relative links and redaction scan | Handoff is reproducible, bounded, and payload-free. |
| Historical preservation | safety regression | `git diff --exit-code 7f87a92 --` against the twelve protected archived Phase 8–13 paths | No archive changes. [VERIFIED: codebase grep — Phase 16 validator contract] |
| Protected dirty state | safety regression | Compare `.planning/config.json` and `.planning/ui-reviews/.gitignore` to captured baselines and ensure unstaged | Exact baseline preserved. [VERIFIED: codebase grep — Phase 16/17 protected baselines] |

### Sampling rate

- Per documentation task: link/path validation, redaction scan, `git diff --check`.
- Per wave: `npm run lint` and `npm run format:check` only over maintained scope if docs/source are touched; no archive formatting.
- Phase gate: Phase 16 and Phase 17 validators plus full release-evidence link review before Phase 19 planning. [VERIFIED: codebase grep — `.planning/config.json`, phase validation artifacts]

## Security Domain

Security enforcement is enabled at ASVS level 1. [VERIFIED: codebase grep — `.planning/config.json`]

| Category | Applies | Documentation control |
|---|---|---|
| V2/V3 Authentication/session | No remote auth/session is introduced; local single-user boundary must remain explicit | Do not describe localhost capability as remote authentication. [VERIFIED: codebase grep — project constraints and `docs/decisions.md`] |
| V4 Access control | Yes | Preserve round ID + opaque capability ownership language and fail-closed host promotion. [VERIFIED: codebase grep — `docs/api.md`, Phase 17] |
| V5 Input validation | Yes | Link shared question/settings validation and malformed/future settings evidence; do not document unchecked payload examples. [VERIFIED: codebase grep — `docs/api.md`, Phase 17] |
| V6 Cryptography | No new cryptography | Do not invent security claims; document existing local permissions/redaction only. [VERIFIED: codebase grep — Phase 17] |

### Redaction/consistency checklist

- [ ] No question or answer text, opaque capability, credential, token, or raw host stderr in maintained evidence. [VERIFIED: codebase grep — Phase 17 redaction contract]
- [ ] No absolute user-home paths or machine-specific secrets; use repository-relative paths and bounded metadata. [VERIFIED: codebase grep — Phase 17 evidence scan]
- [ ] Every PASS has a command/artifact/date; every PARTIAL/UNAVAILABLE row has owner, environment, reason, next evidence command, and no-pass wording. [VERIFIED: codebase grep — UAT matrix schema and Phase 17 external rows]
- [ ] Every link resolves; stale counts are labeled historical; current counts come from Phase 16/17 evidence. [VERIFIED: codebase grep — phase artifacts]
- [ ] Archive and protected-file comparisons pass; unrelated dirty files remain untouched. [VERIFIED: user instruction and Phase 16/17 baselines]

## State of the Art

| Older approach | Current approach | Impact |
|---|---|---|
| Treat host timeout text as application timeout | Attribute lifecycle boundary using redacted typed events and host handoff | Avoids false “fixed” claims; see timeout runbook. [VERIFIED: codebase grep] |
| Treat MCP discoverability/fake-host tests as support | Evidence-gated capability states with authenticated/native gates | Unsupported or unavailable hosts remain unpromoted. [VERIFIED: codebase grep] |
| Browser local storage as authoritative recovery | Node-owned durable round record; browser storage as cache/mirror | Documentation must describe exact resume and reconciliation accurately. [VERIFIED: codebase grep — STATE and architecture docs] |
| `/resume/:roundId` browser call | `POST /resume` with `{ roundId }` | Link current route contract and avoid stale Phase 11 wording. [VERIFIED: codebase grep — integration check] |

## Assumptions Log

No `[ASSUMED]` claims are required for this research. All substantive claims are grounded in repository files, current phase artifacts, or the user’s explicit scope. [VERIFIED: research session]

## Open Questions

1. **Which maintained document should own the v1.1.1 release index?**
   - What we know: `docs/README.md`, `docs/maintenance.md`, and `README.md` are maintained entry points; no single final index exists. [VERIFIED: codebase grep]
   - Recommendation: planner should choose one canonical maintained index and make other entry points link to it, avoiding duplicate status tables.

2. **Should stale planning metadata be changed in Phase 18 or via a separate supported transition?**
   - What we know: Phase 16/17 verification explicitly identifies ROADMAP/STATE contradictions, while the user forbids unrelated dirty-file edits. [VERIFIED: codebase grep]
   - Recommendation: include only scoped metadata synchronization required for DOC-01/DOC-02 and verify protected paths before/after.

## Sources

### Primary (HIGH confidence)

- [`.planning/phases/16-cross-phase-uat-full-verification/16-VERIFICATION.md`](../../phases/16-cross-phase-uat-full-verification/16-VERIFICATION.md) — exact local gate labels, counts, archive/protected/redaction checks. [VERIFIED: codebase grep]
- [`.planning/phases/16-cross-phase-uat-full-verification/16-UAT-SUMMARY.md`](../../phases/16-cross-phase-uat-full-verification/16-UAT-SUMMARY.md) — reconciled UAT scope and external limitations. [VERIFIED: codebase grep]
- [`.planning/phases/17-security-privacy-audit/17-VERIFICATION.md`](../../phases/17-security-privacy-audit/17-VERIFICATION.md) and [`17-SECURITY-SUMMARY.md`](../../phases/17-security-privacy-audit/17-SECURITY-SUMMARY.md) — security, privacy, fail-closed, and four external lanes. [VERIFIED: codebase grep]
- [`.planning/milestones/v1.1-INTEGRATION-CHECK.md`](../../milestones/v1.1-INTEGRATION-CHECK.md) — historical rationale and exact documentation drift. [VERIFIED: codebase grep]
- [`package.json`](../../../package.json), [`docs/tech-stack.md`](../../../docs/tech-stack.md), [`docs/testing.md`](../../../docs/testing.md) — maintained command and CI policy. [VERIFIED: codebase grep]

### Secondary (MEDIUM confidence)

- [`README.md`](../../../README.md), [`docs/README.md`](../../../docs/README.md), [`docs/maintenance.md`](../../../docs/maintenance.md), [`docs/timeout-runbook.md`](../../../docs/timeout-runbook.md), host capability cards — maintained operational claims and support vocabulary. [VERIFIED: codebase grep]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new stack; commands and package boundary are declared and evidenced.
- Architecture: HIGH — current architecture and evidence flow are documented in project codebase maps and verification reports.
- Gaps/pitfalls: HIGH — concrete contradictions and unavailable lanes are named by current verification artifacts.

**Research date:** 2026-07-18
**Valid until:** 2026-08-17, or until the next release/evidence run changes counts, statuses, or paths.
