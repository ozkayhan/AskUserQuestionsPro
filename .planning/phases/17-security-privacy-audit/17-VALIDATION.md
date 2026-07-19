# Phase 17 Validation Manifest

This manifest is the executable contract for SEC-01 and SEC-02. It is intentionally evidence-only: source behavior is preserved unless Plan 01 identifies a concrete regression gap.

## Required gates

| Label | Command | Expected |
|---|---|---|
| `sec01-focused` | `node --test test/adapter-contract.test.js test/bridge.test.js test/server.test.js test/round-store.test.js test/round-lifecycle.test.js test/fake-host-conformance.test.js test/host-evidence-matrix.test.js test/cross-platform-evidence.test.js` | Exit 0 |
| `sec02-settings` | `node --test test/settings.test.js test/server.test.js` | Exit 0; malformed/future imports reject and CAS preserves concurrent state |
| `sec02-install` | `node --test test/install.test.js test/cli-adapters.test.js test/shell-lifecycle.test.js test/host-install-gates.test.js` | Exit 0; exact target scope and fail-closed unavailable hosts |
| `sec02-package` | `node --test test/package-boundary.test.js test/release-gates.test.js` | Exit 0; allowlist and zero production dependencies |
| `full-suite` | `npm test` | Exit 0 with only documented expected skip |
| `lint` | `npm run lint` | Exit 0 |
| `format` | `npm run format:check` | Exit 0 |
| `package-dry-run` | `npm pack --dry-run --json` | Exit 0; inspect only intended files |
| `production-dependency-audit` | `npm audit --audit-level=high --omit=dev` | Exit 0 or record actual bounded result |
| `shell-syntax` | `bash -n install.sh uninstall.sh reinstall.sh` | Exit 0 |
| `shellcheck` | `shellcheck -S warning install.sh uninstall.sh reinstall.sh` | Exit 0, or UNAVAILABLE only with command-not-found evidence |
| `evidence-redaction-scan` | `node --test test/host-evidence-matrix.test.js test/cross-platform-evidence.test.js test/fake-host-conformance.test.js` | Exit 0; no payload/path leakage |
| `promotion-fail-closed` | `node --test test/host-evidence-matrix.test.js test/host-install-gates.test.js` | Exit 0; unavailable/unsupported rows cannot promote |
| `protected-file-snapshot/comparison` | baseline-relative `git diff --`, cached diff, `git hash-object`, `git ls-files -s`, status, then `cmp`/`diff` | Exit 0 for each protected file; unchanged and not staged |
| `authenticated-claude` | External authenticated Claude session handoff; no local substitute may promote this lane | `UNAVAILABLE` with owner, environment, reason, and next evidence/command; never PASS |
| `authenticated-codex` | External authenticated Codex session handoff; no local substitute may promote this lane | `UNAVAILABLE` with owner, environment, reason, and next evidence/command; never PASS |
| `native-windows` | Native Windows installer/host validation handoff | `UNAVAILABLE` with owner, environment, reason, and next evidence/command; never PASS |
| `native-linux` | Native Linux installer/host validation handoff | `UNAVAILABLE` with owner, environment, reason, and next evidence/command; never PASS |

## Helper preflight and deterministic record contract

Plan 02 Task 1 is a Wave 0 preflight for all gates below. It creates executable `17-run-audit.sh` and `17-validate-audit.mjs`, captures complete baselines for `.planning/config.json` and `.planning/ui-reviews/.gitignore`, and smoke-tests both helpers before invoking any audit command. The smoke test proves one known label parses and a duplicate or omitted field fails. No test, package, shell, or validator invocation may precede this preflight.

`17-run-audit.sh` emits exactly one record per manifest label in manifest order with `command:`, `status:`, `output/summary:`, and `interpretation:` fields. Status values are `PASS`, `FAIL`, or `UNAVAILABLE`; the four external lanes must be `UNAVAILABLE` and include machine-parseable `owner:`, `environment:`, `reason:`, and `next evidence/command:` fields. The validator rejects duplicate, unknown, missing, or reordered labels, rejects PASS for any external lane, checks the archive command/ref/path set and exit 0, and checks protected-file baseline equality plus unstaged status.

## Protected and external evidence rules

Before execution capture complete baseline records for `.planning/config.json` and `.planning/ui-reviews/.gitignore`; after execution compare each record to its baseline. Do not compare these intentional dirty files to `origin/main`. Preserve all archives and source files.

Every verification record must contain exactly one label plus `command:`, `status:`, `output/summary:`, and `interpretation:`. Reject duplicates and broad keyword-only evidence. Report output must exclude question text, answer values, tokens/secrets, arbitrary imported values, commands, and user-specific absolute paths.

Authenticated Claude/Codex sessions and native Windows/Linux execution are unavailable in this workspace. Record each exact label as `UNAVAILABLE` with owner, exact environment, reason, and next evidence/command; never count it as local PASS or promote capability status from it. The final summary must repeat all four records individually.

## Immutable archive comparison contract

The immutable baseline is commit `7f87a92`, the v1.1 UAT evidence ref used in Phase 16. The archive set is exactly these twelve paths:

`.planning/milestones/v1.1-phases/08-lifecycle-contract-observability/08-UAT.md`, `.planning/milestones/v1.1-phases/08-lifecycle-contract-observability/08-VERIFICATION.md`, `.planning/milestones/v1.1-phases/09-durable-round-store-recovery-api/09-UAT.md`, `.planning/milestones/v1.1-phases/09-durable-round-store-recovery-api/09-VERIFICATION.md`, `.planning/milestones/v1.1-phases/10-settings-v2/10-UAT.md`, `.planning/milestones/v1.1-phases/10-settings-v2/10-VERIFICATION.md`, `.planning/milestones/v1.1-phases/11-browser-recovery-delivery-ux/11-UAT.md`, `.planning/milestones/v1.1-phases/11-browser-recovery-delivery-ux/11-VERIFICATION.md`, `.planning/milestones/v1.1-phases/12-adapter-contract-tier-1-acceptance/12-UAT.md`, `.planning/milestones/v1.1-phases/12-adapter-contract-tier-1-acceptance/12-VERIFICATION.md`, `.planning/milestones/v1.1-phases/13-evidence-gated-host-expansion-launch-hardening/13-UAT.md`, `.planning/milestones/v1.1-phases/13-evidence-gated-host-expansion-launch-hardening/13-VERIFICATION.md`.

The runner must execute `git diff --exit-code 7f87a92 -- <all twelve paths>` and require exit 0, record the exact command and result under `archive-immutability`, and independently verify every path exists and matches the baseline. The validator must reject missing/extra paths, a different ref, nonzero status, or a summary that omits per-path preservation. The summary must state the ref, all-twelve count, exit 0, and preservation result.

## Plan-owned executables

Plan 02 owns `17-run-audit.sh` and `17-validate-audit.mjs` as deterministic helpers created and smoke-tested in its first task before use. They write only Phase 17 evidence artifacts, the protected baseline record, and temporary files; they must not modify app source, v1.1 archives, or pre-existing dirty user files.
