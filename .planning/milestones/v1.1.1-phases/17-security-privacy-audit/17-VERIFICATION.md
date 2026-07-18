# Phase 17 Verification Report

## LABEL: sec01-focused
command: node --test --test-concurrency=1 test/adapter-contract.test.js test/bridge.test.js test/server.test.js test/round-store.test.js test/round-lifecycle.test.js test/fake-host-conformance.test.js test/host-evidence-matrix.test.js test/cross-platform-evidence.test.js
status: 0
output/summary: TAP version 13
interpretation: Local security and lifecycle coverage.

## LABEL: sec02-settings
command: node --test --test-concurrency=1 test/settings.test.js test/server.test.js
status: 0
output/summary: TAP version 13
interpretation: Settings rejection and CAS coverage.

## LABEL: sec02-install
command: node --test --test-concurrency=1 test/install.test.js test/cli-adapters.test.js test/shell-lifecycle.test.js test/host-install-gates.test.js
status: 0
output/summary: TAP version 13
interpretation: Installer scope and fail-closed host gates.

## LABEL: sec02-package
command: node --test --test-concurrency=1 test/package-boundary.test.js test/release-gates.test.js
status: 0
output/summary: TAP version 13
interpretation: Package allowlist and dependency contract.

## LABEL: full-suite
command: npm test -- --test-concurrency=1 test/*.test.js
status: 0
output/summary: (no output)
interpretation: Full unit/integration suite; browser CLI evidence is run as a dedicated release gate to avoid scheduler and daemon-socket races.

## LABEL: lint
command: npm run lint
status: 0
output/summary: (no output)
interpretation: Lint.

## LABEL: format
command: npm run format:check
status: 0
output/summary: (no output)
interpretation: Format.

## LABEL: package-dry-run
command: npm pack --dry-run --json >/dev/null
status: 0
output/summary: (no output)
interpretation: Published package dry-run.

## LABEL: production-dependency-audit
command: npm audit --audit-level=high --omit=dev
status: 0
output/summary: found 0 vulnerabilities
interpretation: Production dependency audit.

## LABEL: shell-syntax
command: bash -n install.sh uninstall.sh reinstall.sh
status: 0
output/summary: (no output)
interpretation: Installer syntax.

## LABEL: shellcheck
command: shellcheck -S warning install.sh uninstall.sh reinstall.sh
status: 0
output/summary: (no output)
interpretation: ShellCheck.

## LABEL: evidence-redaction-scan
command: node --test --test-concurrency=1 test/host-evidence-matrix.test.js test/cross-platform-evidence.test.js test/fake-host-conformance.test.js
status: 0
output/summary: TAP version 13
interpretation: Evidence redaction.

## LABEL: promotion-fail-closed
command: node --test --test-concurrency=1 test/host-evidence-matrix.test.js test/host-install-gates.test.js
status: 0
output/summary: TAP version 13
interpretation: Promotion rejects unavailable hosts.

## LABEL: archive-immutability
command: git diff --exit-code 7f87a92 -- .planning/milestones/v1.1-phases/08-lifecycle-contract-observability/08-UAT.md .planning/milestones/v1.1-phases/08-lifecycle-contract-observability/08-VERIFICATION.md .planning/milestones/v1.1-phases/09-durable-round-store-recovery-api/09-UAT.md .planning/milestones/v1.1-phases/09-durable-round-store-recovery-api/09-VERIFICATION.md .planning/milestones/v1.1-phases/10-settings-v2/10-UAT.md .planning/milestones/v1.1-phases/10-settings-v2/10-VERIFICATION.md .planning/milestones/v1.1-phases/11-browser-recovery-delivery-ux/11-UAT.md .planning/milestones/v1.1-phases/11-browser-recovery-delivery-ux/11-VERIFICATION.md .planning/milestones/v1.1-phases/12-adapter-contract-tier-1-acceptance/12-UAT.md .planning/milestones/v1.1-phases/12-adapter-contract-tier-1-acceptance/12-VERIFICATION.md .planning/milestones/v1.1-phases/13-evidence-gated-host-expansion-launch-hardening/13-UAT.md .planning/milestones/v1.1-phases/13-evidence-gated-host-expansion-launch-hardening/13-VERIFICATION.md
status: 0
output/summary: (no output)
interpretation: Immutable v1.1 archive comparison; ref 7f87a92; all twelve paths preserved.

archive-ref: 7f87a92
archive-path-count: 12
preserved: .planning/milestones/v1.1-phases/08-lifecycle-contract-observability/08-UAT.md
preserved: .planning/milestones/v1.1-phases/08-lifecycle-contract-observability/08-VERIFICATION.md
preserved: .planning/milestones/v1.1-phases/09-durable-round-store-recovery-api/09-UAT.md
preserved: .planning/milestones/v1.1-phases/09-durable-round-store-recovery-api/09-VERIFICATION.md
preserved: .planning/milestones/v1.1-phases/10-settings-v2/10-UAT.md
preserved: .planning/milestones/v1.1-phases/10-settings-v2/10-VERIFICATION.md
preserved: .planning/milestones/v1.1-phases/11-browser-recovery-delivery-ux/11-UAT.md
preserved: .planning/milestones/v1.1-phases/11-browser-recovery-delivery-ux/11-VERIFICATION.md
preserved: .planning/milestones/v1.1-phases/12-adapter-contract-tier-1-acceptance/12-UAT.md
preserved: .planning/milestones/v1.1-phases/12-adapter-contract-tier-1-acceptance/12-VERIFICATION.md
preserved: .planning/milestones/v1.1-phases/13-evidence-gated-host-expansion-launch-hardening/13-UAT.md
preserved: .planning/milestones/v1.1-phases/13-evidence-gated-host-expansion-launch-hardening/13-VERIFICATION.md
## LABEL: protected-file-snapshot/comparison
command: compare complete protected baseline and unstaged status
status: 0
output/summary: protected baseline comparison
interpretation: protected files unchanged and unstaged.
.planning/config.json
matching baseline: yes
not staged: yes
.planning/ui-reviews/.gitignore
matching baseline: yes
not staged: yes

## LABEL: authenticated-claude
command: external authenticated Claude session handoff
status: UNAVAILABLE
output/summary: no authenticated Claude environment is attached
interpretation: UNAVAILABLE; not promotion evidence.
owner: project maintainer
environment: authenticated Claude Code session
reason: unavailable in this workspace
next evidence/command: run version-pinned authenticated Claude long-round acceptance

## LABEL: authenticated-codex
command: external authenticated Codex session handoff
status: UNAVAILABLE
output/summary: no authenticated Codex environment is attached
interpretation: UNAVAILABLE; not promotion evidence.
owner: project maintainer
environment: authenticated Codex session
reason: unavailable in this workspace
next evidence/command: run version-pinned authenticated Codex long-round acceptance

## LABEL: native-windows
command: native Windows installer and host validation handoff
status: UNAVAILABLE
output/summary: no native Windows environment is attached
interpretation: UNAVAILABLE; not promotion evidence.
owner: project maintainer
environment: native Windows host
reason: unavailable in this workspace
next evidence/command: run installer and host gates on native Windows

## LABEL: native-linux
command: native Linux installer and host validation handoff
status: UNAVAILABLE
output/summary: no native Linux environment is attached
interpretation: UNAVAILABLE; not promotion evidence.
owner: project maintainer
environment: native Linux host
reason: unavailable in this workspace
next evidence/command: run installer and host gates on native Linux
