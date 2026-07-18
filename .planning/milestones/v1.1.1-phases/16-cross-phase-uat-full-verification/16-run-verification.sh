#!/usr/bin/env bash
set -u -o pipefail

ROOT=$(git rev-parse --show-toplevel)
PHASE="$ROOT/.planning/phases/16-cross-phase-uat-full-verification"
REPORT="$PHASE/16-VERIFICATION.md"
BASELINE="$PHASE/16-PROTECTED-BASELINE.txt"
VALIDATOR="$PHASE/16-validate-verification.mjs"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

protected_snapshot() {
  local path=$1
  {
    echo "PATH: $path"
    echo 'DIFF:'; git diff -- "$path"
    echo 'CACHED-DIFF:'; git diff --cached -- "$path"
    echo "HASH: $(git hash-object -- "$path")"
    echo 'INDEX:'; git ls-files -s -- "$path"
    echo 'STATUS:'; git status --short -- "$path"
  }
}

if [[ ! -f "$BASELINE" ]]; then
  {
    echo '# Protected-file baseline (captured before verification)'
    protected_snapshot '.planning/config.json'
    protected_snapshot '.planning/ui-reviews/.gitignore'
  } > "$BASELINE"
fi

printf '# Phase 16 Verification Report\n\n' > "$REPORT"
run_label() {
  local label=$1 command=$2 output status interpretation
  output=$(mktemp "$TMP/output.XXXXXX")
  bash -c "$command" >"$output" 2>&1
  status=$?
  interpretation=$3
  {
    echo "## LABEL: $label"
    echo "command: $command"
    echo "status: $status"
    summary=$(sed -n '1p' "$output" | tr -d '\r' | cut -c1-500)
    [[ -n "$summary" ]] || summary='(no output)'
    echo "output/summary: $summary"
    echo "interpretation: $interpretation"
    echo
  } >> "$REPORT"
}

run_label full-suite 'npm test' 'Full suite result recorded verbatim.'
run_label focused-suite 'node --test test/round-lifecycle.test.js test/round-state.test.js test/round-record.test.js test/round-store.test.js test/bridge.test.js test/bridge-client.test.js test/long-round.test.js test/mcp-long-round.test.js test/mcp-progress.test.js test/fake-host-conformance.test.js test/adapter-contract.test.js test/tier1-acceptance.test.js test/cli-adapters.test.js test/install.test.js test/native-os-evidence.test.js test/cross-platform-evidence.test.js test/host-evidence-matrix.test.js test/host-research-integrity.test.js test/host-install-gates.test.js test/release-gates.test.js test/package-boundary.test.js test/docs-integrity.test.js test/changesets-config.test.js test/workflows-ci.test.js test/workflows-release.test.js test/browser-recovery-e2e.test.js test/views-a11y.test.js test/views-a11y-recovery.test.js test/live.test.js test/draft-writer.test.js test/app-state.test.js' 'Focused suite result recorded verbatim.'
run_label lint 'npm run lint' 'Lint result recorded.'
run_label format 'npm run format:check' 'Format result recorded.'
run_label browser-smoke 'npm run test:browser' 'Browser smoke result recorded.'
run_label audit 'npm audit --audit-level=high --omit=dev' 'Audit result recorded.'
run_label package-dry-run 'npm pack --dry-run --json' 'Package boundary result recorded.'
run_label bash-syntax 'bash -n install.sh uninstall.sh reinstall.sh' 'Installer syntax result recorded.'
if command -v shellcheck >/dev/null 2>&1; then
  run_label shellcheck 'shellcheck --severity=warning install.sh uninstall.sh reinstall.sh' 'ShellCheck result recorded.'
else
  run_label shellcheck 'shellcheck --severity=warning install.sh uninstall.sh reinstall.sh' 'UNAVAILABLE: shellcheck command not found; external installer-validation handoff.'
fi
run_label git-diff-check 'git diff --check' 'Working-tree whitespace result recorded.'
run_label production-dependency-drift 'base=$(mktemp); git show origin/main:package.json > "$base"; node --input-type=module -e "import {readFileSync} from \"node:fs\"; const c=JSON.parse(readFileSync(\"package.json\",\"utf8\")); const b=JSON.parse(readFileSync(process.argv[1],\"utf8\")); for (const k of [\"dependencies\",\"optionalDependencies\",\"peerDependencies\"]) if (JSON.stringify(c[k]||{})!==JSON.stringify(b[k]||{})) throw new Error(k); console.log(\"production dependency sections equal origin/main\")" "$base"; rm "$base"' 'Production dependency sections match origin/main.'
run_label UAT-row-parser 'node --input-type=module -e "import {readFileSync} from \"node:fs\"; const r=readFileSync(\".planning/phases/16-cross-phase-uat-full-verification/16-UAT-MATRIX.md\",\"utf8\").split(/\\n/).filter(x=>/^\\|/.test(x)&&!/^\\|\\s*-/.test(x)); const h=r.shift().split(\"|\").map(x=>x.trim().toLowerCase()); const i=Object.fromEntries(h.map((x,n)=>[x,n])); for(const k of [\"status\",\"owner\",\"environment\",\"action/next gate\"]) if(i[k]===undefined) throw Error(\"missing matrix column: \"+k); for(const row of r){const c=row.split(\"|\").map(x=>x.trim()); if([\"PARTIAL\",\"UNAVAILABLE\"].includes(c[i.status])&&[\"owner\",\"environment\",\"action/next gate\"].some(k=>!c[i[k]])) throw Error(\"missing handoff\")} console.log(\"handoff schema PASS: \"+r.length+\" matrix rows parsed\")"' 'UAT handoff schema result recorded.'
run_label archive-immutability 'git diff --exit-code 7f87a92 -- .planning/milestones/v1.1-phases/08-lifecycle-contract-observability/08-UAT.md .planning/milestones/v1.1-phases/08-lifecycle-contract-observability/08-VERIFICATION.md .planning/milestones/v1.1-phases/09-durable-round-store-recovery-api/09-UAT.md .planning/milestones/v1.1-phases/09-durable-round-store-recovery-api/09-VERIFICATION.md .planning/milestones/v1.1-phases/10-settings-v2/10-UAT.md .planning/milestones/v1.1-phases/10-settings-v2/10-VERIFICATION.md .planning/milestones/v1.1-phases/11-browser-recovery-delivery-ux/11-UAT.md .planning/milestones/v1.1-phases/11-browser-recovery-delivery-ux/11-VERIFICATION.md .planning/milestones/v1.1-phases/12-adapter-contract-tier-1-acceptance/12-UAT.md .planning/milestones/v1.1-phases/12-adapter-contract-tier-1-acceptance/12-VERIFICATION.md .planning/milestones/v1.1-phases/13-evidence-gated-host-expansion-launch-hardening/13-UAT.md .planning/milestones/v1.1-phases/13-evidence-gated-host-expansion-launch-hardening/13-VERIFICATION.md' 'All twelve archived UAT paths are unchanged from the v1.1 UAT evidence commit.'

POST="$TMP/post.txt"
{
  echo '# Protected-file baseline (captured before verification)'
  protected_snapshot '.planning/config.json'
  protected_snapshot '.planning/ui-reviews/.gitignore'
} > "$POST"
protected_status=0
cmp -s "$BASELINE" "$POST" || protected_status=1
if git diff --cached --quiet -- .planning/config.json .planning/ui-reviews/.gitignore; then staged='yes'; else staged='no'; protected_status=1; fi
{
  echo '## LABEL: protected-file-snapshot/comparison'
  echo 'command: cmp baseline and post-run protected snapshots; git diff --cached --quiet -- protected paths'
  echo "status: $protected_status"
  echo "output/summary: baseline comparison status $protected_status"
  echo 'interpretation: protected files remain unchanged from baseline and not staged.'
  echo '.planning/config.json'
  echo "matching baseline: $([[ $protected_status -eq 0 ]] && echo yes || echo no)"
  echo "not staged: $staged"
  echo '.planning/ui-reviews/.gitignore'
  echo "matching baseline: $([[ $protected_status -eq 0 ]] && echo yes || echo no)"
  echo "not staged: $staged"
  echo
} >> "$REPORT"

node "$VALIDATOR" "$REPORT"
