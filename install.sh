#!/usr/bin/env bash
set -euo pipefail

# curl | bash ile çalışması için: eğer lokal çalışırsa DIR = script dir,
# curl'den çalışırsa GitHub'dan indir
if [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then
  DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
else
  # curl | bash: GitHub'dan indir ve temp dir'de kur
  TMPDIR="$(mktemp -d)"
  trap "rm -rf $TMPDIR" EXIT
  echo "📥 AskUserQuestionsPro GitHub'dan indiriliyor..."
  curl -fsSL "https://github.com/ozkayhan/AskUserQuestionsPro/archive/refs/heads/main.zip" -o "$TMPDIR/repo.zip"
  unzip -q "$TMPDIR/repo.zip" -d "$TMPDIR"
  DIR="$TMPDIR/AskUserQuestionsPro-main"
fi

SETTINGS="$HOME/.claude/settings.json"
HOOK="$DIR/hooks/askuser-bridge.mjs"

mkdir -p "$HOME/.claude"
[ -f "$SETTINGS" ] || echo '{}' > "$SETTINGS"

# AskUserQuestion için zaten bir PreToolUse hook var mı uyar (issue #15897).
if grep -q '"AskUserQuestion"' "$SETTINGS" 2>/dev/null; then
  echo "UYARI: settings.json içinde zaten 'AskUserQuestion' geçiyor — tek PreToolUse hook olmalı. Elle kontrol edin."
fi

# jq ile hook'u ekle (jq yoksa elle ekleme talimatı bas).
if command -v jq >/dev/null 2>&1; then
  tmp="$(mktemp)"
  jq --arg cmd "node $HOOK" '
    .hooks //= {} |
    .hooks.PreToolUse //= [] |
    .hooks.PreToolUse += [{ "matcher": "AskUserQuestion",
      "hooks": [{ "type": "command", "command": $cmd, "timeout": 360 }] }]
  ' "$SETTINGS" > "$tmp" && mv "$tmp" "$SETTINGS"
  echo "Hook eklendi → $SETTINGS"
else
  cat <<EOF
jq bulunamadı. $SETTINGS dosyasına elle ekleyin:

  "hooks": {
    "PreToolUse": [
      { "matcher": "AskUserQuestion",
        "hooks": [{ "type": "command", "command": "node $HOOK", "timeout": 360 }] }
    ]
  }
EOF
fi
echo "Bitti. Yeni bir 'claude' oturumu açın; AskUserQuestion artık özel arayüzde açılır."
