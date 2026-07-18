# Phase 16 Validation Manifest

This manifest defines the evidence required for UAT-01 and UAT-02. It is a validation manifest, not a second reconciliation artifact; `16-UAT-MATRIX.md` is the only reconciliation matrix for this phase.

## Requirement-to-check map

| Requirement | Check | Expected result | Skip/unavailable handling |
|---|---|---|---|
| UAT-01 | Archived Phase 8–13 UAT and verification paths listed below | Every path exists and `git diff --exit-code 7f87a92 -- <path list>` is clean | Missing archive path or missing v1.1 UAT evidence commit fails; current Phase 16 files are outside this immutable list |
| UAT-01 | `16-UAT-MATRIX.md` source-link, status, redaction, and handoff-field audit | One matrix; all links resolve; PASS/PARTIAL/UNAVAILABLE are bounded; a row-by-row parser fails any PARTIAL/UNAVAILABLE row with an empty owner, environment, or action/next gate | No unsupported host/native/browser claims are accepted |
| UAT-02 | `npm test` | 505 pass, zero failures, one expected Playwright-package skip when reproduced | Record actual result; do not normalize differing counts |
| UAT-02 | Exact focused 179-test `node --test` inventory from `16-RESEARCH.md` | 179 pass, zero failures, zero skips | Record actual result |
| UAT-02 | `npm run lint` and `npm run format:check` | Exit 0 | Record actual result |
| UAT-02 | `npm run test:browser` | Exit 0 for available smoke lane | Not full browser-runtime or AT evidence |
| UAT-02 | `npm audit --audit-level=high --omit=dev` | Exit 0 / no high findings | Record actual result |
| UAT-02 | `npm pack --dry-run --json` | Exit 0 and package boundary is unchanged | Record actual result |
| UAT-02 | `bash -n install.sh uninstall.sh reinstall.sh` | Exit 0 | Record actual result |
| UAT-02 | ShellCheck conditional | If available, warning-level ShellCheck exits 0; if unavailable, write an `UNAVAILABLE` row with command-not-found reason and continue | Unavailable is an external installer-validation handoff, never PASS |
| UAT-01/UAT-02 | `git diff --check`, production-dependency drift, protected-file checks | Each executable command exits 0; current production dependency sections equal `origin/main`; protected files match captured pre-existing diff/hash/index snapshots and remain unstaged | Do not require pristine files; fail only on changes from the captured baseline |
| UAT-01/UAT-02 | Final report-evidence gate | `16-VERIFICATION.md` contains every required command or stable label, exit status, output/summary, and interpretation | Missing any section or field fails |

## Immutable Phase 8–13 archive paths

The following twelve explicit paths are the complete archive immutability set:

```text
.planning/milestones/v1.1-phases/08-lifecycle-contract-observability/08-UAT.md
.planning/milestones/v1.1-phases/08-lifecycle-contract-observability/08-VERIFICATION.md
.planning/milestones/v1.1-phases/09-durable-round-store-recovery-api/09-UAT.md
.planning/milestones/v1.1-phases/09-durable-round-store-recovery-api/09-VERIFICATION.md
.planning/milestones/v1.1-phases/10-settings-v2/10-UAT.md
.planning/milestones/v1.1-phases/10-settings-v2/10-VERIFICATION.md
.planning/milestones/v1.1-phases/11-browser-recovery-delivery-ux/11-UAT.md
.planning/milestones/v1.1-phases/11-browser-recovery-delivery-ux/11-VERIFICATION.md
.planning/milestones/v1.1-phases/12-adapter-contract-tier-1-acceptance/12-UAT.md
.planning/milestones/v1.1-phases/12-adapter-contract-tier-1-acceptance/12-VERIFICATION.md
.planning/milestones/v1.1-phases/13-evidence-gated-host-expansion-launch-hardening/13-UAT.md
.planning/milestones/v1.1-phases/13-evidence-gated-host-expansion-launch-hardening/13-VERIFICATION.md
```

## Handoff schema gate

Every matrix or summary row whose status is `PARTIAL` or `UNAVAILABLE` must expose these non-empty fields:

| Field | Required content |
|---|---|
| `owner` | Person/team/environment owner responsible for the next run |
| `environment` | Exact host, OS, browser, AT, or runtime environment needed |
| `action/next gate` | Concrete next action and the evidence/status transition it can unlock |

Unsupported claims include treating fake-host, MCP, source-contract, CI configuration, or browser smoke output as authenticated host, native OS, full browser-runtime, or AT evidence.

## Executable validation commands

## Plan index and owned executables

| Plan | Wave | Depends on | Owned files | Exact command |
|---|---:|---|---|---|
| `16-00-PLAN.md` | 0 | none | `16-run-verification.sh`, `16-validate-verification.mjs` | `bash -n .planning/phases/16-cross-phase-uat-full-verification/16-run-verification.sh && node --check .planning/phases/16-cross-phase-uat-full-verification/16-validate-verification.mjs && node .planning/phases/16-cross-phase-uat-full-verification/16-validate-verification.mjs --self-test` |
| `16-01-PLAN.md` | 1 | none | `16-UAT-MATRIX.md`, `16-VALIDATION.md` | `node --input-type=module -e "...matrix parser..."` |
| `16-02-PLAN.md` | 2 | `16-00`, `16-01` | `16-PROTECTED-BASELINE.txt`, `16-VERIFICATION.md`, `16-UAT-SUMMARY.md` | `bash .planning/phases/16-cross-phase-uat-full-verification/16-run-verification.sh && node .planning/phases/16-cross-phase-uat-full-verification/16-validate-verification.mjs .planning/phases/16-cross-phase-uat-full-verification/16-VERIFICATION.md` |

Wave 0 owns the executable harness; Wave 1 creates the matrix; Wave 2 is the only plan that runs the harness and publishes final evidence. The runner writes only Phase 16 evidence files and temporary files and must not edit source, archives, or protected dirty files.

Run these from the repository root and copy each command's stdout and exit status into `16-VERIFICATION.md`:

```sh
node --input-type=module -e "import {readFileSync} from 'node:fs'; const rows=readFileSync('.planning/phases/16-cross-phase-uat-full-verification/16-UAT-MATRIX.md','utf8').split(/\n/).filter(x=>/^\|/.test(x)&&!/^\|\s*-/.test(x)); const header=rows.shift().split('|').map(x=>x.trim().toLowerCase()); const ix=Object.fromEntries(header.map((x,i)=>[x,i])); for (const k of ['status','owner','environment','action/next gate']) if (ix[k]===undefined) throw new Error('missing matrix column: '+k); const bad=[]; for (const row of rows) { const c=row.split('|').map(x=>x.trim()); if (['PARTIAL','UNAVAILABLE'].includes(c[ix.status])) for (const k of ['owner','environment','action/next gate']) if (!c[ix[k]]) bad.push(c[ix.status]+' row missing '+k); } if (bad.length) throw new Error(bad.join('; ')); console.log('handoff schema PASS: '+rows.length+' matrix rows parsed');"
git diff --check
origin_package=$(mktemp)
git show origin/main:package.json > "$origin_package"
node --input-type=module -e "import {readFileSync} from 'node:fs'; const current=JSON.parse(readFileSync('package.json','utf8')); const base=JSON.parse(readFileSync(process.argv[1],'utf8')); for (const k of ['dependencies','optionalDependencies','peerDependencies']) if (JSON.stringify(current[k]||{})!==JSON.stringify(base[k]||{})) throw new Error('production dependency drift in '+k); console.log('production dependency drift PASS: package.json production dependency sections equal origin/main');" "$origin_package"
rm "$origin_package"
```

The parser is the deterministic gate for every matrix row; all three outputs are mandatory evidence in `16-VERIFICATION.md`.

## Protected dirty-file baseline and archive evidence

Before any Phase 16 execution, write `16-PROTECTED-BASELINE.txt` with the complete `git diff`, `git diff --cached`, worktree `git hash-object`, and `git ls-files -s` output for `.planning/config.json` and `.planning/ui-reviews/.gitignore`, plus their index/staged status. After execution, compare each command's output and require exit 0, recording command, status, output, and interpretation in `16-VERIFICATION.md`; the interpretation must explicitly say the files are unchanged from baseline and not staged. A nonzero `git diff` relative to `origin/main` is expected for these two files and is not a failure.

Run the explicit archive command `git diff --exit-code 7f87a92 -- <all twelve paths in the immutable archive list>` and require exit 0. The v1.1 UAT evidence commit `7f87a92` is the immutable baseline because the `v1.1` tag and `origin/main` both predate the archived UAT report files in this checkout. Record the exact command, exit status, output, and interpretation in `16-VERIFICATION.md`.

The primary sequence must execute and record these exact labels individually: `full-suite`, `focused-suite`, `lint`, `format`, `browser-smoke`, `audit`, `package-dry-run`, `bash-syntax`, `shellcheck`, `git-diff-check`, `production-dependency-drift`, `UAT-row-parser`, `archive-immutability`, and `protected-file-snapshot/comparison`. Each label must occur exactly once in `16-VERIFICATION.md` and its record must contain non-empty `command:`, `status:`, `output/summary:`, and `interpretation:` fields. The final validator must parse records structurally; broad keyword presence, proximity windows, or one aggregate status cannot satisfy this gate. It must fail on any missing or duplicate label, missing field, absent primary-sequence result, archive status other than 0, or missing per-file protected comparison.

Protected-file comparison is executable and baseline-relative. For each of `.planning/config.json` and `.planning/ui-reviews/.gitignore`, regenerate the exact post-run diff, cached diff, worktree hash, index entry, and status records, then run `cmp`/`diff` against the corresponding baseline sections in `16-PROTECTED-BASELINE.txt`; each comparison must exit 0 and record `matching baseline: yes` and `not staged: yes`. A nonzero diff against `origin/main` for these files is expected and must not be used as the protected-file verdict.

UAT row parser, archive immutability, and production dependency drift are mandatory commands in the primary automated sequence, not optional follow-up checks. Their command, actual status, output/summary, and interpretation must be present in the report; the final validator fails when any is absent.
