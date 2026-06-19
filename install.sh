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
INSTALL_DIR="$HOME/.local/share/askuserquestionspro"
mkdir -p "$INSTALL_DIR"
# Re-run'da bayat dosya kalmasın diye hedefi önce temizle (içerik idempotency).
rm -rf "$INSTALL_DIR/hooks" "$INSTALL_DIR/web" "$INSTALL_DIR/server" "$INSTALL_DIR/lib" "$INSTALL_DIR/mcp-server"
cp -R "$DIR/hooks" "$INSTALL_DIR/"
[ -d "$DIR/web" ]        && cp -R "$DIR/web"        "$INSTALL_DIR/"
[ -d "$DIR/server" ]     && cp -R "$DIR/server"     "$INSTALL_DIR/"
[ -d "$DIR/lib" ]        && cp -R "$DIR/lib"        "$INSTALL_DIR/"
[ -d "$DIR/mcp-server" ] && cp -R "$DIR/mcp-server" "$INSTALL_DIR/"

SETTINGS="$HOME/.claude/settings.json"
HOOK="$INSTALL_DIR/hooks/askuserquestionspro-bridge.mjs"
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
# MCP sunucusunu claude CLI'ya global olarak kaydet (idempotent: önce kaldır, sonra ekle).
MCP_ENTRY="$INSTALL_DIR/mcp-server/askuserquestionspro-mcp.mjs"
if command -v claude >/dev/null 2>&1; then
  claude mcp remove askuserquestionspro >/dev/null 2>&1 || true
  claude mcp add --scope user askuserquestionspro -- node "$MCP_ENTRY" || true
  echo "MCP aracı (mcp__askuserquestionspro__ask) kullanıcı kapsamında kaydedildi → askuserquestionspro"
else
  echo "claude CLI bulunamadı. MCP aracını elle kaydetmek için:"
  echo "  claude mcp add --scope user askuserquestionspro -- node \"$MCP_ENTRY\""
fi

echo ""
echo "Bitti. Yeni bir 'claude' oturumu açın."
echo "  • Az soru (≤4): AskUserQuestion hook'u yerel AMOLED arayüzü açar."
echo "  • Çok soru: model mcp__askuserquestionspro__ask aracını kullanır (sınırsız, tek ekran)."
echo "Çok uzun anketlerde gerekirse \`MCP_TOOL_TIMEOUT\` artırılabilir (varsayılan pratikte sınırsızdır)."
