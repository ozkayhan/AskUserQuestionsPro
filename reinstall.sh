#!/usr/bin/env bash
# askuserquestionspro'yu MacBook'tan KALINTISIZ kaldırır, sonra GitHub'dan
# en güncel halini çekip tüm kurulumu yapar (hook + MCP + bridge dosyaları).
# Idempotent: tekrar tekrar çalıştırılabilir. `set -e` yok — kaldırma adımları
# bir şey bulamasa da devam etmeli.
set -uo pipefail

REPO="https://github.com/ozkayhan/AskUserQuestionsPro"
INSTALL_DIR="$HOME/.local/share/askuserquestionspro"
SETTINGS="$HOME/.claude/settings.json"
PORT="${ASKUSER_PORT:-4517}"

echo "═══ 1/5  Çalışan köprü süreçleri kapatılıyor (port $PORT) ═══"
pids="$(lsof -ti "tcp:$PORT" 2>/dev/null || true)"
if [ -n "$pids" ]; then
  kill $pids 2>/dev/null && echo "  SIGTERM gönderildi: $pids"
  # Sürecin kapanmasını bekle; 1 sn sonra hâlâ yaşıyorsa -9
  for i in $(seq 1 10); do
    sleep 0.1
    remaining="$(lsof -ti "tcp:$PORT" 2>/dev/null || true)"
    [ -z "$remaining" ] && break
  done
  remaining="$(lsof -ti "tcp:$PORT" 2>/dev/null || true)"
  if [ -n "$remaining" ]; then
    kill -9 $remaining 2>/dev/null && echo "  SIGKILL gönderildi: $remaining"
    sleep 0.2
  fi
  echo "  süreç kapatıldı"
else
  echo "  çalışan süreç yok"
fi

echo "═══ 2/5  MCP kaydı kaldırılıyor ═══"
if command -v claude >/dev/null 2>&1; then
  claude mcp remove --scope user askuserquestionspro >/dev/null 2>&1 || true
  claude mcp remove askuserquestionspro >/dev/null 2>&1 || true   # scope'suz fallback
  echo "  MCP kaydı temizlendi"
else
  echo "  claude CLI yok — MCP adımı atlandı"
fi

echo "═══ 3/5  ~/.claude/settings.json hook'u kaldırılıyor ═══"
if [ -f "$SETTINGS" ] && command -v jq >/dev/null 2>&1; then
  tmp="$(mktemp)"
  # askuserquestionspro geçen tüm PreToolUse entry'lerini at; PreToolUse boşsa anahtarı sil.
  jq '
    if .hooks.PreToolUse then
      .hooks.PreToolUse |= map(select(
        ([.hooks[]?.command // ""] | join(" ") | test("askuserquestionspro") | not)
      ))
      | (if (.hooks.PreToolUse | length) == 0 then del(.hooks.PreToolUse) else . end)
    else . end
  ' "$SETTINGS" > "$tmp" && mv "$tmp" "$SETTINGS" && echo "  hook temizlendi" || { rm -f "$tmp"; echo "  jq hatası — settings dokunulmadı"; }
else
  echo "  settings.json veya jq yok — atlandı"
fi

echo "═══ 4/5  Dosyalar ve olası npm global kurulumu siliniyor ═══"
rm -rf "$INSTALL_DIR" && echo "  silindi: $INSTALL_DIR"
rm -rf "$HOME/.config/askuserquestionspro" && echo "  UI ayarları silindi" || true
npm uninstall -g askuserquestionspro >/dev/null 2>&1 && echo "  npm global kaldırıldı" || echo "  npm global kurulum yoktu"

echo
echo "═══ 5/5  GitHub'dan en güncel sürüm kuruluyor ═══"
curl -fsSL "$REPO/raw/main/install.sh" | bash

echo
echo "═══ Doğrulama ═══"
[ -d "$INSTALL_DIR" ] && echo "  ✔ dosyalar: $INSTALL_DIR" || echo "  ✗ dosyalar EKSİK"
grep -q askuserquestionspro "$SETTINGS" 2>/dev/null && echo "  ✔ hook: $SETTINGS" || echo "  ✗ hook yok"
command -v claude >/dev/null 2>&1 && { claude mcp list 2>/dev/null | grep -q askuserquestionspro && echo "  ✔ MCP kayıtlı" || echo "  ✗ MCP yok"; }
echo
echo "Bitti. Yeni bir 'claude' oturumu açın."
