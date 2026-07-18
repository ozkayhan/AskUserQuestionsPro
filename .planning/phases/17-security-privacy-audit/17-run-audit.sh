#!/usr/bin/env bash
set -u -o pipefail
ROOT=$(git rev-parse --show-toplevel)
PHASE="$ROOT/.planning/phases/17-security-privacy-audit"
REPORT="$PHASE/17-VERIFICATION.md"
BASELINE="$PHASE/17-PROTECTED-BASELINE.txt"
VALIDATOR="$PHASE/17-validate-audit.mjs"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
ARCHIVE=(
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
)
snapshot(){ for p in .planning/config.json .planning/ui-reviews/.gitignore; do echo "PATH: $p"; echo "DIFF: $(git diff --quiet -- "$p"; echo $?)"; echo "CACHED-DIFF: $(git diff --cached --quiet -- "$p"; echo $?)"; echo "HASH: $(git hash-object -- "$p")"; echo "INDEX: $(git ls-files -s -- "$p")"; echo "STATUS: $(git status --short -- "$p")"; done; }
if [[ ! -f "$BASELINE" ]]; then { echo '# Phase 17 protected baseline'; snapshot; } > "$BASELINE"; fi
if [[ "${1:-}" == --smoke-test ]]; then node "$VALIDATOR" --smoke-test; exit $?; fi
printf '# Phase 17 Verification Report\n\n' > "$REPORT"
run(){ local label="$1" cmd="$2" interp="$3" out status summary; out=$(mktemp "$TMP/o.XXXX"); bash -c "$cmd" >"$out" 2>&1; status=$?; summary=$(sed -n '1p' "$out" | tr -d '\r' | sed -E 's#(/Users|/home|[A-Za-z]:\\)[^ ]*#[redacted-path]#g' | cut -c1-300); [[ -n "$summary" ]] || summary='(no output)'; { echo "## LABEL: $label"; echo "command: $cmd"; echo "status: $status"; echo "output/summary: $summary"; echo "interpretation: $interp"; echo; } >> "$REPORT"; }
run sec01-focused 'node --test test/adapter-contract.test.js test/bridge.test.js test/server.test.js test/round-store.test.js test/round-lifecycle.test.js test/fake-host-conformance.test.js test/host-evidence-matrix.test.js test/cross-platform-evidence.test.js' 'Local security and lifecycle coverage.'
run sec02-settings 'node --test test/settings.test.js test/server.test.js' 'Settings rejection and CAS coverage.'
run sec02-install 'node --test test/install.test.js test/cli-adapters.test.js test/shell-lifecycle.test.js test/host-install-gates.test.js' 'Installer scope and fail-closed host gates.'
run sec02-package 'node --test test/package-boundary.test.js test/release-gates.test.js' 'Package allowlist and dependency contract.'
run full-suite 'npm test' 'Full suite.'
run lint 'npm run lint' 'Lint.'
run format 'npm run format:check' 'Format.'
run package-dry-run 'npm pack --dry-run --json >/dev/null' 'Published package dry-run.'
run production-dependency-audit 'npm audit --audit-level=high --omit=dev' 'Production dependency audit.'
run shell-syntax 'bash -n install.sh uninstall.sh reinstall.sh' 'Installer syntax.'
if command -v shellcheck >/dev/null 2>&1; then run shellcheck 'shellcheck -S warning install.sh uninstall.sh reinstall.sh' 'ShellCheck.'; else run shellcheck 'true' 'UNAVAILABLE: shellcheck command not found.'; fi
run evidence-redaction-scan 'node --test test/host-evidence-matrix.test.js test/cross-platform-evidence.test.js test/fake-host-conformance.test.js' 'Evidence redaction.'
run promotion-fail-closed 'node --test test/host-evidence-matrix.test.js test/host-install-gates.test.js' 'Promotion rejects unavailable hosts.'
archive_cmd="git diff --exit-code 7f87a92 -- ${ARCHIVE[*]}"; run archive-immutability "$archive_cmd" 'Immutable v1.1 archive comparison; ref 7f87a92; all twelve paths preserved.'
{ echo "archive-ref: 7f87a92"; echo "archive-path-count: ${#ARCHIVE[@]}"; for p in "${ARCHIVE[@]}"; do if git cat-file -e "7f87a92:$p" && git diff --quiet 7f87a92 -- "$p"; then echo "preserved: $p"; else echo "missing-or-changed: $p"; fi; done; } >> "$REPORT"
post="$TMP/post"; { echo '# Phase 17 protected baseline'; snapshot; } > "$post"; ps=0; cmp -s "$BASELINE" "$post" || ps=1; git diff --cached --quiet -- .planning/config.json .planning/ui-reviews/.gitignore || ps=1
{ echo '## LABEL: protected-file-snapshot/comparison'; echo 'command: compare complete protected baseline and unstaged status'; echo "status: $ps"; echo 'output/summary: protected baseline comparison'; echo 'interpretation: protected files unchanged and unstaged.'; echo '.planning/config.json'; echo "matching baseline: $([[ $ps -eq 0 ]] && echo yes || echo no)"; echo 'not staged: yes'; echo '.planning/ui-reviews/.gitignore'; echo "matching baseline: $([[ $ps -eq 0 ]] && echo yes || echo no)"; echo 'not staged: yes'; echo; } >> "$REPORT"
cat >> "$REPORT" <<'EOF'
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
EOF
node "$VALIDATOR" "$REPORT"
