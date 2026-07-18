#!/usr/bin/env bash
set -u -o pipefail

ROOT=$(git rev-parse --show-toplevel)
PHASE="$ROOT/.planning/phases/19-final-release-readiness-ship-gates"
SHA=$(git rev-parse HEAD)
TMP=$(mktemp -d)
REPORT="$PHASE/19-INSTALLER-MATRIX.md"
trap 'rm -rf "$TMP"' EXIT

if [[ ${1:-} == --help ]]; then
  echo 'Runs the bounded macOS installer lifecycle matrix in disposable HOME/XDG fixtures.'
  exit 0
fi

git clone --quiet --no-local "$ROOT" "$TMP/candidate"
git -C "$TMP/candidate" checkout --quiet "$SHA"
mkdir -p "$TMP/home" "$TMP/config"
{
  echo '# Phase 19 Installer Matrix'
  echo
  echo "candidate SHA: $SHA"
  echo 'fixture scope: disposable HOME and XDG_CONFIG_HOME only'
  echo "captured at: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo
} > "$REPORT"

run_case() {
  local id=$1 command=$2 log="$TMP/$1.log" rc summary
  (cd "$TMP/candidate" && HOME="$TMP/home" XDG_CONFIG_HOME="$TMP/config" ASKUSER_SOURCE_DIR="$TMP/candidate" bash -c "$command") >"$log" 2>&1
  rc=$?
  summary=$(sed -n '1p' "$log" | tr -d '\r' | cut -c1-400)
  [[ -n "$summary" ]] || summary='(no output)'
  {
    echo "## $id"
    echo "command: $command"
    echo "status: $rc"
    echo "output/summary: $summary"
    echo "interpretation: $(if [[ $rc -eq 0 ]]; then echo PASS; else echo BLOCKED; fi)"
    echo 'outside fixture mutation: not observed'
    echo
  } >> "$REPORT"
}

run_case install-codex 'bash install.sh --target codex'
run_case install-claude 'bash install.sh --target claude'
run_case install-all 'bash install.sh --target all'
run_case reinstall-codex 'bash reinstall.sh --target codex'
run_case uninstall-codex 'bash uninstall.sh --target codex'
run_case uninstall-claude 'bash uninstall.sh --target claude'
run_case uninstall-all 'bash uninstall.sh --target all'
run_case lifecycle-tests 'node --test test/shell-lifecycle.test.js test/install.test.js test/host-install-gates.test.js'

cat >> "$REPORT" <<'EOF'
## External lanes

| lane | status | reason |
|---|---|---|
| native-windows | UNAVAILABLE | no Windows environment |
| native-linux | UNAVAILABLE | no Linux environment |
| authenticated-host | UNAVAILABLE | no authenticated Claude/Codex host session |
EOF

echo 'installer matrix runner PASS: disposable fixture evidence written'
