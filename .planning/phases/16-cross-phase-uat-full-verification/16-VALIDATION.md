# Phase 16 Validation Manifest

This manifest defines the evidence required for UAT-01 and UAT-02. It is a validation manifest, not a second reconciliation artifact; `16-UAT-MATRIX.md` is the only reconciliation matrix for this phase.

## Requirement-to-check map

| Requirement | Check | Expected result | Skip/unavailable handling |
|---|---|---|---|
| UAT-01 | Archived Phase 8–13 UAT and verification paths listed below | Every path exists and `git diff --exit-code origin/main -- <path list>` is clean | Missing archive path fails; current Phase 16 files are outside this immutable list |
| UAT-01 | `16-UAT-MATRIX.md` source-link, status, redaction, and handoff-field audit | One matrix; all links resolve; PASS/PARTIAL/UNAVAILABLE are bounded; a row-by-row parser fails any PARTIAL/UNAVAILABLE row with an empty owner, environment, or action/next gate | No unsupported host/native/browser claims are accepted |
| UAT-02 | `npm test` | 505 pass, zero failures, one expected Playwright-package skip when reproduced | Record actual result; do not normalize differing counts |
| UAT-02 | Exact focused 179-test `node --test` inventory from `16-RESEARCH.md` | 179 pass, zero failures, zero skips | Record actual result |
| UAT-02 | `npm run lint` and `npm run format:check` | Exit 0 | Record actual result |
| UAT-02 | `npm run test:browser` | Exit 0 for available smoke lane | Not full browser-runtime or AT evidence |
| UAT-02 | `npm audit --audit-level=high --omit=dev` | Exit 0 / no high findings | Record actual result |
| UAT-02 | `npm pack --dry-run --json` | Exit 0 and package boundary is unchanged | Record actual result |
| UAT-02 | `bash -n install.sh uninstall.sh reinstall.sh` | Exit 0 | Record actual result |
| UAT-02 | ShellCheck conditional | If available, warning-level ShellCheck exits 0; if unavailable, write an `UNAVAILABLE` row with command-not-found reason and continue | Unavailable is an external installer-validation handoff, never PASS |
| UAT-01/UAT-02 | `git diff --check`, production-dependency drift, protected-file checks | Each executable command exits 0; no protected config/gitignore changes or staging; current production dependency sections equal `origin/main` | Fail on unexpected changes |

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
