#!/usr/bin/env bash
set -euo pipefail

# curl | bash ile çalışması için: eğer lokal çalışırsa DIR = script dir,
# curl'den çalışırsa GitHub'dan indir
if [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then
  DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
else
  # curl | bash: GitHub'dan indir ve temp dir'de aç (temp betik bitince silinir)
  TMPDIR="$(mktemp -d)"
  trap "rm -rf $TMPDIR" EXIT
  echo "📥 AskUserQuestionsPro GitHub'dan indiriliyor..."
  curl -fsSL "https://github.com/ozkayhan/AskUserQuestionsPro/archive/refs/heads/main.zip" -o "$TMPDIR/repo.zip"
  unzip -q "$TMPDIR/repo.zip" -d "$TMPDIR"
  DIR="$TMPDIR/AskUserQuestionsPro-main"
fi

# Hook ve web dosyalarını KALICI bir konuma kopyala. $DIR temp dir olabilir
# (curl | bash) ve betik bitince silinir; bu yüzden hook'un kalıcı bir yolu olmalı.
INSTALL_DIR="$HOME/.local/share/claude-askui"
mkdir -p "$INSTALL_DIR"
cp -R "$DIR/hooks" "$INSTALL_DIR/"
[ -d "$DIR/web" ] && cp -R "$DIR/web" "$INSTALL_DIR/"

SETTINGS="$HOME/.claude/settings.json"
HOOK="$INSTALL_DIR/hooks/askuser-bridge.mjs"
CMD="node \"$HOOK\""

mkdir -p "$HOME/.claude"
[ -f "$SETTINGS" ] || echo '{}' > "$SETTINGS"

# AskUserQuestion için zaten bizim olmayan bir PreToolUse hook var mı uyar (issue #15897).
if grep -q '"AskUserQuestion"' "$SETTINGS" 2>/dev/null; then
  echo "UYARI: settings.json içinde zaten 'AskUserQuestion' geçiyor — tek PreToolUse hook olmalı. Elle kontrol edin."
fi

# jq ile hook'u idempotent ekle: aynı komut zaten varsa TEKRAR EKLEME.
if command -v jq >/dev/null 2>&1; then
  tmp="$(mktemp)"
  jq --arg cmd "$CMD" '
    .hooks //= {} |
    .hooks.PreToolUse //= [] |
    if any(.hooks.PreToolUse[]?; .hooks[]?.command == $cmd) then
      .
    else
      .hooks.PreToolUse += [{ "matcher": "AskUserQuestion",
        "hooks": [{ "type": "command", "command": $cmd, "timeout": 360 }] }]
    end
  ' "$SETTINGS" > "$tmp" && mv "$tmp" "$SETTINGS"
  echo "Hook eklendi (idempotent) → $SETTINGS"
else
  cat <<EOF
jq bulunamadı. $SETTINGS dosyasına elle ekleyin:

  "hooks": {
    "PreToolUse": [
      { "matcher": "AskUserQuestion",
        "hooks": [{ "type": "command", "command": "$CMD", "timeout": 360 }] }
    ]
  }
EOF
fi
echo "Bitti. Yeni bir 'claude' oturumu açın; AskUserQuestion artık özel arayüzde açılır."
