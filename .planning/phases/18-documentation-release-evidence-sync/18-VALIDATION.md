# Phase 18 Validation Manifest

The executable validator is `18-validate.mjs`, created by Wave 0. The complete gate command is `node .planning/phases/18-documentation-release-evidence-sync/18-validate.mjs`; `--capture-baseline` writes `.planning/phases/18-documentation-release-evidence-sync/18-baseline.json` without reset, checkout, clean, or other destructive operation. It is the only command executors use for plan-level validation. Before any Phase 18 edit, capture the existing worktree/index/untracked state; this preserves intentional Phase 17 changes as baseline state rather than treating them as Phase 18 edits.

This manifest is the executable contract for DOC-01 and DOC-02. It permits maintained-document and planning-metadata edits explicitly listed by the Phase 18 plans; application source, Phase 8–13 archives, protected dirty files, and unrelated worktree content are outside scope and must remain unchanged.

## Required gates

| Label | Command/check | Expected |
|---|---|---|
| maintained-doc-integrity | `node --test test/docs-integrity.test.js` | Exit 0; maintained index and relative links resolve |
| handoff-link-scan | `node --input-type=module -e "import fs from 'node:fs'; import path from 'node:path'; const files=['docs/README.md','docs/evidence/v1.1.1-release-handoff.md']; const bad=[]; for (const f of files) for (const m of fs.readFileSync(f,'utf8').matchAll(/\\]\(([^)#]+)(?:#[^)]+)?\\)/g)) { const t=m[1]; if (!t.startsWith('http') && !t.startsWith('#') && !fs.existsSync(path.resolve(path.dirname(f),t))) bad.push(f+' -> '+t); } if (bad.length) throw new Error(bad.join('\\n')); console.log('maintained relative-link scan PASS');"` | Every repository-relative target exists |
| handoff-schema | `node --input-type=module -e "import fs from 'node:fs'; const x=fs.readFileSync('docs/evidence/v1.1.1-release-handoff.md','utf8'); for (const t of ['full-suite','focused-suite','lint','format','authenticated-claude','authenticated-codex','native-windows','native-linux','owner','environment','reason','next evidence','Phase 19']) if (!x.includes(t)) throw new Error('missing '+t); if (!/UNAVAILABLE/.test(x)) throw new Error('missing bounded status'); console.log('handoff schema PASS');"` | PASS rows have provenance; unavailable lanes have all handoff fields and never become PASS |
| redaction-scan | Shared validator uses `String.raw` fragments and `new RegExp`, including an escaped absolute-home delimiter; no regex literal contains an unescaped slash delimiter. | No payloads, credentials/tokens, absolute home paths, capabilities, or raw host stderr |
| lint | `npm run lint` | Exit 0 |
| format | `npm run format:check` | Exit 0 under the explicit maintained scope |
| diff-check | `git diff --check` | Exit 0 |
| metadata-consistency | `node --input-type=module -e "import fs from 'node:fs'; const r=fs.readFileSync('.planning/ROADMAP.md','utf8'), q=fs.readFileSync('.planning/REQUIREMENTS.md','utf8'), s=fs.readFileSync('.planning/STATE.md','utf8'); for (const id of ['UAT-01','UAT-02','SEC-01','SEC-02','DOC-01','DOC-02']) if (!(r.includes(id)&&q.includes(id))) throw new Error('missing '+id); if (!/current_phase:\s*18/.test(s)) throw new Error('STATE current phase is not 18'); if (!/DOC-01[^\\n]*(Pending|pending)/.test(r+q) || !/DOC-02[^\\n]*(Pending|pending)/.test(r+q)) throw new Error('DOC requirements must remain pending before execution'); console.log('metadata/requirement/roadmap consistency PASS');"` | Prior completed requirements agree, Phase 18 is current, DOC-01/DOC-02 remain pending |
| archive-immutability | `git diff --exit-code 7f87a92 -- .planning/milestones/v1.1-phases/08-lifecycle-contract-observability/08-UAT.md .planning/milestones/v1.1-phases/08-lifecycle-contract-observability/08-VERIFICATION.md .planning/milestones/v1.1-phases/09-durable-round-store-recovery-api/09-UAT.md .planning/milestones/v1.1-phases/09-durable-round-store-recovery-api/09-VERIFICATION.md .planning/milestones/v1.1-phases/10-settings-v2/10-UAT.md .planning/milestones/v1.1-phases/10-settings-v2/10-VERIFICATION.md .planning/milestones/v1.1-phases/11-browser-recovery-delivery-ux/11-UAT.md .planning/milestones/v1.1-phases/11-browser-recovery-delivery-ux/11-VERIFICATION.md .planning/milestones/v1.1-phases/12-adapter-contract-tier-1-acceptance/12-UAT.md .planning/milestones/v1.1-phases/12-adapter-contract-tier-1-acceptance/12-VERIFICATION.md .planning/milestones/v1.1-phases/13-evidence-gated-host-expansion-launch-hardening/13-UAT.md .planning/milestones/v1.1-phases/13-evidence-gated-host-expansion-launch-hardening/13-VERIFICATION.md` | Exit 0; exact twelve paths preserved |
| protected-file-comparison | Shared validator compares each protected file’s captured baseline worktree hash and bytes, baseline-relative unstaged diff, index hash, cached diff, and status; it requires unchanged/not-staged relative to capture while tolerating pre-existing edits elsewhere. | Protected files are unchanged by Phase 18 and not newly staged |
| source-edit-policy | Shared validator computes baseline-relative tracked worktree/index paths and untracked paths, then rejects every new unauthorized path. Only declared maintained docs, planning metadata, Phase 18 artifacts, and the validator baseline are allowed; Phase 17 paths already present in the capture remain permitted. `.playwright-cli/` is an explicitly protected runtime-output directory and is ignored for freshness classification without being edited or deleted. | Unauthorized tracked worktree/index/untracked changes fail |

## Gate order

Run `node .planning/phases/18-documentation-release-evidence-sync/18-validate.mjs` in this order: maintained-doc-integrity and handoff-link-scan; handoff-schema and redaction-scan; metadata-consistency; archive-immutability and protected-file-comparison; source-edit-policy; lint, format, diff-check, and integrity. The command runs every gate and exits nonzero on any failure.

The smoke contract is `node --test .planning/phases/18-documentation-release-evidence-sync/18-validator-smoke-fixture.mjs` followed by `node .planning/phases/18-documentation-release-evidence-sync/18-validate.mjs --smoke`. Smoke mode dispatches every gate against deterministic fixtures and never writes the repository baseline. The validator exports the manifest, redaction, link, schema, metadata, protected, archive, source-policy, and smoke hooks so the fixture can assert both positive and negative behavior without changing application source, archives, protected files, or `.playwright-cli`.

## Evidence rules

Use current Phase 14–17 verification artifacts for current counts and statuses. Link historical v1.0.0/v1.1 rationale and archived reports without rewriting or copying them. Keep authenticated Claude/Codex and native Windows/Linux rows `UNAVAILABLE` until owner-supplied evidence exists. Record actual command, status, summary, interpretation, date/snapshot, and scope for each local gate; record owner, environment, reason, and next evidence command for each external row.

## Completion record

Executed 2026-07-18 on the existing workspace baseline:

| Check | Result | Evidence |
|---|---|---|
| validator smoke fixture | PASS | `node 18-validator-smoke-fixture.mjs` — 3 tests passed |
| validator smoke dispatch | PASS | `node 18-validate.mjs --smoke` — all 12 gates dispatched |
| complete validator | PASS with bounded diff-check deviation | `node 18-validate.mjs` — maintained docs, links, schema, redaction, metadata, archive `7f87a92`, protected-file, source-boundary, lint, format, and integrity PASS; only `diff-check` is blocked by the pre-existing line below |
| focused documentation/integrity suite | PASS | `npm test -- --test-name-pattern='docs|integrity'` — 55 passed, 0 failed |
| exact diff-check | BOUNDED | `git diff --check` reports only `.planning/phases/17-security-privacy-audit/17-VERIFICATION.md:101` (`_Verified: 2026-07-18T13:00:00Z_` with trailing spaces). This is a pre-existing user-owned Phase 17 verification document and was not edited. |

The exact archive comparison remains `git diff --exit-code 7f87a92 --` over the twelve Phase 8–13 UAT/verification paths listed above. The protected baseline remains unchanged for `.planning/config.json` and `.planning/ui-reviews/.gitignore`; application source, archives, `.playwright-cli`, and unrelated dirty files were not touched. No raw logs, payloads, credentials, absolute user paths, or machine-specific host stderr are included here.
