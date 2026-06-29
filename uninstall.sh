#!/usr/bin/env bash
# askuserquestionspro — production-grade KALINTISIZ kaldırma.
# Bridge süreçleri + hook + MCP kaydı + dosyalar + UI ayarları + npm global +
# askpro skill — hepsini temizler, sonra kalıntı kalmadığını doğrular.
# `set -e` YOK — bir adım bulamasa bile temizlik devam etmeli. FAIL ile özetler.
#
# Kullanım: uninstall.sh [--keep-skill]
#   --keep-skill / KEEP_SKILL=1 → ~/.claude/skills/askpro silinmez (reinstall kullanır).
set -uo pipefail

INSTALL_DIR="$HOME/.local/share/askuserquestionspro"
SETTINGS="$HOME/.claude/settings.json"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/askuserquestionspro"
SKILL_DIR="$HOME/.claude/skills/askpro"
PORT="${ASKUSER_PORT:-4517}"

KEEP_SKILL="${KEEP_SKILL:-0}"
[ "${1:-}" = "--keep-skill" ] && KEEP_SKILL=1

# ── log helper'ları ──────────────────────────────────────────────────────────
if [ -t 1 ]; then
  C_RESET=$'\033[0m'; C_DIM=$'\033[2m'; C_RED=$'\033[31m'
  C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_BLUE=$'\033[34m'; C_BOLD=$'\033[1m'
else
  C_RESET=; C_DIM=; C_RED=; C_GREEN=; C_YELLOW=; C_BLUE=; C_BOLD=
fi
info() { printf '%s\n' "${C_DIM}$*${C_RESET}"; }
step() { printf '%s\n' "${C_BOLD}${C_BLUE}▸ $*${C_RESET}"; }
ok()   { printf '%s\n' "${C_GREEN}  ✔ $*${C_RESET}"; }
warn() { printf '%s\n' "${C_YELLOW}  ⚠ $*${C_RESET}"; }
err()  { printf '%s\n' "${C_RED}  ✗ $*${C_RESET}" >&2; }

FAIL=0

printf '%s\n\n' "${C_BOLD}AskUserQuestionsPro kaldırma${C_RESET}"

# ── 1/5 Çalışan bridge süreçlerini kapat ────────────────────────────────────
step "1/5  Çalışan köprü süreçleri kapatılıyor (port $PORT)"
if command -v lsof >/dev/null 2>&1; then
  readarray -t pids < <(lsof -ti "tcp:$PORT" 2>/dev/null || true)
  if [ "${#pids[@]}" -gt 0 ]; then
    kill "${pids[@]}" 2>/dev/null && info "  SIGTERM → ${pids[*]}"
    for _ in $(seq 1 10); do
      sleep 0.1
      readarray -t remaining < <(lsof -ti "tcp:$PORT" 2>/dev/null || true)
      [ "${#remaining[@]}" -eq 0 ] && break
    done
    readarray -t remaining < <(lsof -ti "tcp:$PORT" 2>/dev/null || true)
    if [ "${#remaining[@]}" -gt 0 ]; then
      kill -9 "${remaining[@]}" 2>/dev/null && info "  SIGKILL → ${remaining[*]}"
      sleep 0.2
    fi
    ok "süreç(ler) kapatıldı"
  else
    ok "çalışan süreç yok"
  fi
else
  warn "lsof yok — süreç kontrolü atlandı"
fi

# ── 2/5 Hook'u settings.json'dan kaldır ──────────────────────────────────────
step "2/5  Hook ~/.claude/settings.json'dan kaldırılıyor"
# 2a. Primer: bundled Node logic (exact-path, atomic).
if [ -f "$INSTALL_DIR/bin/cli.js" ]; then
  node "$INSTALL_DIR/bin/cli.js" uninstall >/dev/null 2>&1 && info "  bundled uninstall çalıştı" || true
fi
# 2b. Savunma amaçlı jq süpürmesi: askuserquestionspro geçen TÜM PreToolUse
#     entry'lerini at (eski/farklı-path kurulumlardan kalıntı için), boş anahtarları buda.
if [ -f "$SETTINGS" ] && command -v jq >/dev/null 2>&1; then
  tmp="$(mktemp)"
  if jq '
    if .hooks.PreToolUse then
      .hooks.PreToolUse |= map(select(
        ([.hooks[]?.command // ""] | join(" ") | test("askuserquestionspro") | not)
      ))
      | (if (.hooks.PreToolUse | length) == 0 then del(.hooks.PreToolUse) else . end)
      | (if (.hooks // {} | length) == 0 then del(.hooks) else . end)
    else . end
  ' "$SETTINGS" > "$tmp" && jq -e . "$tmp" >/dev/null 2>&1; then
    mv "$tmp" "$SETTINGS"
    ok "hook temizlendi (intent-based sweep)"
  else
    rm -f "$tmp"; warn "jq sweep başarısız — settings dokunulmadı"
  fi
elif [ -f "$INSTALL_DIR/bin/cli.js" ]; then
  ok "hook bundled logic ile kaldırıldı (jq yok)"
else
  warn "jq ve bundled logic yok — hook elle kontrol edilmeli: $SETTINGS"
fi

# ── 3/5 MCP kaydını kaldır ───────────────────────────────────────────────────
step "3/5  MCP kaydı kaldırılıyor"
if command -v claude >/dev/null 2>&1; then
  claude mcp remove --scope user askuserquestionspro >/dev/null 2>&1 || true
  claude mcp remove askuserquestionspro >/dev/null 2>&1 || true   # scope'suz fallback
  ok "MCP kaydı temizlendi"
else
  warn "claude CLI yok — MCP adımı atlandı"
fi

# ── 4/5 Dosyalar, UI ayarları, npm global ───────────────────────────────────
step "4/5  Dosyalar ve ayarlar siliniyor"
if rm -rf "$INSTALL_DIR"; then ok "silindi: $INSTALL_DIR"; else err "$INSTALL_DIR silinemedi"; FAIL=1; fi
if rm -rf "$CONFIG_DIR"; then ok "silindi: $CONFIG_DIR (UI ayarları)"; else err "$CONFIG_DIR silinemedi"; FAIL=1; fi
if command -v npm >/dev/null 2>&1; then
  npm uninstall -g askuserquestionspro >/dev/null 2>&1 || true
  info "  npm global temizlik denendi (varsa kaldırıldı)"
fi

# ── 5/5 Skill ───────────────────────────────────────────────────────────────
step "5/5  askpro skill"
if [ "$KEEP_SKILL" -eq 1 ]; then
  info "  --keep-skill → korunuyor: $SKILL_DIR"
elif [ -d "$SKILL_DIR" ]; then
  if rm -rf "$SKILL_DIR"; then ok "silindi: $SKILL_DIR"; else err "$SKILL_DIR silinemedi"; FAIL=1; fi
else
  ok "skill zaten yok"
fi

# ── Doğrulama (kalıntısızlık) ────────────────────────────────────────────────
printf '\n%s\n' "${C_BOLD}Kalıntı kontrolü${C_RESET}"
if [ ! -d "$INSTALL_DIR" ]; then ok "dosyalar yok"; else err "kalıntı: $INSTALL_DIR"; FAIL=1; fi
if [ ! -d "$CONFIG_DIR" ]; then ok "UI ayarları yok"; else err "kalıntı: $CONFIG_DIR"; FAIL=1; fi
if [ "$KEEP_SKILL" -eq 1 ]; then
  info "  skill korundu (kontrol atlandı)"
elif [ ! -d "$SKILL_DIR" ]; then
  ok "skill yok"
else
  err "kalıntı: $SKILL_DIR"; FAIL=1
fi
# Hook gerçekten gitti mi?
if [ -f "$SETTINGS" ] && command -v jq >/dev/null 2>&1; then
  if jq -e '[.. | objects | select(has("command")) | .command // "" | select(test("askuserquestionspro"))] | length > 0' "$SETTINGS" >/dev/null 2>&1; then
    err "kalıntı: settings.json'da hâlâ askuserquestionspro hook var"; FAIL=1
  else
    ok "hook yok"
  fi
elif [ -f "$SETTINGS" ] && grep -q askuserquestionspro "$SETTINGS"; then
  warn "settings.json'da askuserquestionspro geçiyor (jq yok — elle kontrol edin)"
else
  ok "hook yok"
fi
# MCP gitti mi?
if command -v claude >/dev/null 2>&1; then
  if claude mcp list 2>/dev/null | grep -q askuserquestionspro; then err "kalıntı: MCP hâlâ kayıtlı"; FAIL=1; else ok "MCP kaydı yok"; fi
fi
# Port boş mu?
if command -v lsof >/dev/null 2>&1; then
  if [ -z "$(lsof -ti "tcp:$PORT" 2>/dev/null || true)" ]; then ok "port $PORT boş"; else err "port $PORT hâlâ dolu"; FAIL=1; fi
fi

# ── Özet ─────────────────────────────────────────────────────────────────────
printf '\n'
if [ "$FAIL" -eq 0 ]; then
  printf '%s\n' "${C_BOLD}${C_GREEN}✓ Kaldırma tamamlandı — kalıntı yok.${C_RESET}"
else
  printf '%s\n' "${C_BOLD}${C_RED}✗ Kaldırma bitti ama bazı kalıntılar kaldı (yukarıya bakın).${C_RESET}"
fi
exit "$FAIL"
