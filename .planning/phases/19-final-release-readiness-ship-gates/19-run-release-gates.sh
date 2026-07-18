#!/usr/bin/env bash
set -u -o pipefail
ROOT=$(git rev-parse --show-toplevel)
PHASE="$ROOT/.planning/phases/19-final-release-readiness-ship-gates"
REPORT="$PHASE/19-RELEASE-GATES.md"
MAX_OUTPUT=${MAX_OUTPUT:-1200}
TMP=$(mktemp -d "${TMPDIR:-/tmp}/askuserquestionspro-release.XXXXXX")
trap 'rm -rf "$TMP"' EXIT
if [[ "${1:-}" == --help ]]; then echo "Usage: $0"; exit 0; fi
SHA=$(git rev-parse HEAD)
BEFORE_STATUS="$TMP/before-status"; git status --short --untracked-files=all >"$BEFORE_STATUS"
snapshot() { for p in .planning/config.json .planning/ui-reviews/.gitignore .playwright-cli; do if [[ -d "$ROOT/$p" ]]; then find "$ROOT/$p" -type f -print0 | sort -z | xargs -0 shasum -a 256; elif [[ -f "$ROOT/$p" ]]; then shasum -a 256 "$ROOT/$p"; else echo "MISSING $p"; fi; done >"$1"; }
BEFORE_HASHES="$TMP/before-hashes"; snapshot "$BEFORE_HASHES"
CANDIDATE="$TMP/candidate"; LOGS="$TMP/logs"; mkdir -p "$LOGS"
if git clone --no-local --quiet "$ROOT" "$CANDIDATE" >"$TMP/clone.log" 2>&1 && [[ "$(git -C "$CANDIDATE" rev-parse HEAD)" == "$SHA" ]] && [[ -z "$(git -C "$CANDIDATE" status --short --untracked-files=all)" ]]; then clone_status=PASS; else clone_status=BLOCKED; fi
redact() { sed -E 's#(/Users/|/home/|[A-Za-z]:\\Users\\)[^[:space:])]+#[redacted-path]#g; s#(password|secret|token|credential|authorization|bearer)[[:space:]]*[:=][[:space:]]*[^[:space:]]+#[redacted-secret]#Ig' | head -c "$MAX_OUTPUT"; }
RESULTS="$TMP/results"; : >"$RESULTS"
run_gate() { local label="$1"; shift; local command_text="$*" log status summary timestamp; timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ); log="$LOGS/$label.log"; if [[ "$clone_status" != PASS ]]; then printf '%s|%s|BLOCKED|%s|candidate clone failed\n' "$label" "$command_text" "$timestamp" >>"$RESULTS"; return; fi; (cd "$CANDIDATE" && env -i HOME="$TMP/home" PATH="$PATH" TMPDIR="$TMP" CI=1 "$@") >"$log" 2>&1; status=$?; local status_label=PASS; [[ "$status" -eq 0 ]] || status_label=BLOCKED; summary=$(redact <"$log"); [[ -n "$summary" ]] || summary='(no output)'; printf '%s|%s|%s|%s|%s\n' "$label" "$command_text" "$status_label" "$timestamp" "${summary//$'\n'/ }" >>"$RESULTS"; }
run_shellcheck() { if command -v shellcheck >/dev/null 2>&1; then run_gate shellcheck shellcheck --severity=warning install.sh uninstall.sh reinstall.sh; else printf '%s|%s|UNAVAILABLE|%s|shellcheck command not found\n' shellcheck 'shellcheck --severity=warning install.sh uninstall.sh reinstall.sh' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >>"$RESULTS"; fi; }
run_gate node-version node --version
run_gate npm-version npm --version
run_gate npm-ci npm ci
run_gate full-suite npm test
run_gate lint npm run lint
run_gate format npm run format:check
run_gate production-dependency-audit npm audit --audit-level=high --omit=dev
run_gate package-dry-run npm pack --dry-run --json
run_gate shell-syntax bash -n install.sh uninstall.sh reinstall.sh
run_shellcheck
run_gate focused-package-release-host-install node --test test/package-boundary.test.js test/release-gates.test.js test/workflows-ci.test.js test/workflows-release.test.js test/host-install-gates.test.js test/shell-lifecycle.test.js
run_gate focused-docs-host-evidence node --test test/docs-integrity.test.js test/host-evidence-matrix.test.js test/cross-platform-evidence.test.js test/fake-host-conformance.test.js
run_gate phase-17-security-audit bash .planning/phases/17-security-privacy-audit/17-run-audit.sh
run_gate phase-18-documentation-validator node .planning/phases/18-documentation-release-evidence-sync/18-validate.mjs
run_gate diff-check git diff --check
AFTER_HASHES="$TMP/after-hashes"; snapshot "$AFTER_HASHES"; AFTER_STATUS="$TMP/after-status"; git status --short --untracked-files=all >"$AFTER_STATUS"; preservation=PASS; cmp -s "$BEFORE_HASHES" "$AFTER_HASHES" || preservation=BLOCKED; cmp -s "$BEFORE_STATUS" "$AFTER_STATUS" || preservation=BLOCKED
{ echo '# Phase 19 Release Gates'; echo; echo "- Candidate SHA: \`$SHA\`"; echo "- Started (UTC): $(date -u +%Y-%m-%dT%H:%M:%SZ)"; echo "- Candidate isolation: $clone_status"; echo; echo '## Gate Results (ordered)'; echo; echo '| Label | Exact command | Status | Timestamp (UTC) | Bounded output |'; echo '|---|---|---|---|---|'; while IFS='|' read -r label cmd status timestamp summary; do printf '| `%s` | `%s` | **%s** | `%s` | %s |\n' "$label" "$cmd" "$status" "$timestamp" "${summary//|/\\|}"; done <"$RESULTS"; echo; echo '## Dirty Workspace Preservation'; echo; echo 'Pre-run status:'; echo '```text'; cat "$BEFORE_STATUS"; echo '```'; echo; echo "Protected-file postcondition: **$preservation** (byte-identical hashes and unchanged git status)."; echo; echo '## External Handoffs'; echo; echo '| Lane | Status | Owner | Environment | Reason | Next evidence |'; echo '|---|---|---|---|---|---|'; echo '| authenticated-claude | UNAVAILABLE | host integration owner | authenticated Claude session | unavailable in this workspace | version-pinned long-round acceptance |'; echo '| authenticated-codex | UNAVAILABLE | host integration owner | authenticated Codex session | unavailable in this workspace | version-pinned long-round acceptance |'; echo '| native-windows | UNAVAILABLE | release platform owner | native Windows | unavailable in this workspace | installer and recovery matrix |'; echo '| native-linux | UNAVAILABLE | release platform owner | native Linux | unavailable in this workspace | installer and recovery matrix |'; echo; echo '## Version Checkpoint'; echo; echo '- package.json version: 1.1.0'; echo '- milestone target: v1.1.1'; echo '- decision: BLOCKED pending explicit release-owner choice; no version, changeset, tag, or publication was changed.'; } >"$REPORT"
if [[ "$preservation" != PASS ]] || grep -Eq '\|\*\*(BLOCKED|UNAVAILABLE)\*\*\|' "$REPORT"; then exit 2; fi
exit 0
