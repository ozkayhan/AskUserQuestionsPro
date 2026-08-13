#!/usr/bin/env bash
# askuserquestionspro — production-grade KALINTISIZ kaldırma.
# Bridge süreçleri + Claude/Codex/Antigravity hook/MCP kayıtları + dosyalar + UI ayarları +
# npm global + host askpro skill/plugin'leri — hepsini temizler ve doğrular.
# `set -e` YOK — bir adım bulamasa bile temizlik devam etmeli. FAIL ile özetler.
#
# Kullanım: uninstall.sh [--keep-skill] [--target auto|all|claude|codex|antigravity]
#   --keep-skill / KEEP_SKILL=1 → host skill/plugin dizinleri korunur.
set -uo pipefail

INSTALL_DIR="$HOME/.local/share/askuserquestionspro"
SETTINGS="$HOME/.claude/settings.json"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/askuserquestionspro"
CLAUDE_SKILL_DIR="$HOME/.claude/skills/askpro"
CODEX_SKILL_DIR="$HOME/.agents/skills/askpro"
ANTIGRAVITY_PLUGIN_DIR="$HOME/.gemini/antigravity-cli/plugins/askuserquestionspro"
ANTIGRAVITY_MCP_CONFIG="$HOME/.gemini/config/mcp_config.json"
PORT="${ASKUSER_PORT:-4517}"

KEEP_SKILL="${KEEP_SKILL:-0}"
TARGET="${ASKUSER_TARGET:-auto}"

usage() {
  cat <<'EOF'
Kullanım: uninstall.sh [--keep-skill] [--target auto|all|claude|codex|antigravity]
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --keep-skill) KEEP_SKILL=1; shift ;;
    --target)
      [ "$#" -ge 2 ] || { usage >&2; exit 2; }
      TARGET="$2"; shift 2
      ;;
    --target=*) TARGET=${1#*=}; shift ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'Bilinmeyen argüman: %s\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
done
case "$TARGET" in
  auto|all|claude|codex|antigravity) ;;
  *) printf 'Geçersiz target: %s\n' "$TARGET" >&2; usage >&2; exit 2 ;;
esac

find_codex() {
  if [ -n "${ASKUI_CODEX_BIN:-}" ] && [ -x "$ASKUI_CODEX_BIN" ]; then
    printf '%s\n' "$ASKUI_CODEX_BIN"
    return 0
  fi
  if command -v codex >/dev/null 2>&1; then
    command -v codex
    return 0
  fi
  for candidate in \
    "/Applications/ChatGPT.app/Contents/Resources/codex" \
    "/Applications/Codex.app/Contents/Resources/codex" \
    "$HOME/Applications/ChatGPT.app/Contents/Resources/codex" \
    "$HOME/Applications/Codex.app/Contents/Resources/codex"
  do
    if [ -x "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

find_antigravity() {
  if [ -n "${ASKUI_ANTIGRAVITY_BIN:-}" ] && [ -x "$ASKUI_ANTIGRAVITY_BIN" ]; then
    printf '%s\n' "$ASKUI_ANTIGRAVITY_BIN"
    return 0
  fi
  if command -v agy >/dev/null 2>&1; then
    command -v agy
    return 0
  fi
  for candidate in "$HOME/.local/bin/agy" "$HOME/.gemini/antigravity-cli/bin/agy"; do
    if [ -x "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

CLAUDE_APPLIES=0
CODEX_APPLIES=0
ANTIGRAVITY_APPLIES=0
case "$TARGET" in
  all) CLAUDE_APPLIES=1; CODEX_APPLIES=1; ANTIGRAVITY_APPLIES=1 ;;
  claude) CLAUDE_APPLIES=1 ;;
  codex) CODEX_APPLIES=1 ;;
  antigravity) ANTIGRAVITY_APPLIES=1 ;;
  auto)
    if { [ -n "${ASKUI_CLAUDE_BIN:-}" ] && [ -x "$ASKUI_CLAUDE_BIN" ]; } || \
      command -v claude >/dev/null 2>&1 || [ -f "$SETTINGS" ] || [ -d "$CLAUDE_SKILL_DIR" ]; then
      CLAUDE_APPLIES=1
    fi
    if find_codex >/dev/null 2>&1 || [ -d "$CODEX_SKILL_DIR" ]; then
      CODEX_APPLIES=1
    fi
    if find_antigravity >/dev/null 2>&1 || [ -d "$ANTIGRAVITY_PLUGIN_DIR" ] || grep -q askuserquestionspro "$ANTIGRAVITY_MCP_CONFIG" 2>/dev/null; then
      ANTIGRAVITY_APPLIES=1
    fi
    ;;
esac

# Host-specific uninstall must not delete the shared runtime while the other
# host still has an adapter pointing at it.
PRESERVE_SHARED=0
if [ "$TARGET" = "codex" ]; then
  if [ -d "$CLAUDE_SKILL_DIR" ] || \
    { [ -f "$SETTINGS" ] && grep -q askuserquestionspro "$SETTINGS" 2>/dev/null; } || \
    { command -v claude >/dev/null 2>&1 && claude mcp list 2>/dev/null | grep -q askuserquestionspro; }; then
    PRESERVE_SHARED=1
  fi
elif [ "$TARGET" = "claude" ]; then
  CODEX_CONFIG="${CODEX_HOME:-$HOME/.codex}/config.toml"
  CODEX_CMD=$(find_codex 2>/dev/null || true)
  if [ -d "$CODEX_SKILL_DIR" ] || \
    { [ -f "$CODEX_CONFIG" ] && grep -q 'mcp_servers.askuserquestionspro' "$CODEX_CONFIG" 2>/dev/null; } || \
    { [ -n "$CODEX_CMD" ] && "$CODEX_CMD" mcp list 2>/dev/null | grep -q askuserquestionspro; }; then
    PRESERVE_SHARED=1
  fi
elif [ "$TARGET" = "antigravity" ]; then
  CODEX_CONFIG="${CODEX_HOME:-$HOME/.codex}/config.toml"
  CODEX_CMD=$(find_codex 2>/dev/null || true)
  if [ -d "$CLAUDE_SKILL_DIR" ] || \
    { [ -f "$SETTINGS" ] && grep -q askuserquestionspro "$SETTINGS" 2>/dev/null; } || \
    { [ -d "$CODEX_SKILL_DIR" ] || { [ -f "$CODEX_CONFIG" ] && grep -q 'mcp_servers.askuserquestionspro' "$CODEX_CONFIG" 2>/dev/null; }; } || \
    { [ -n "$CODEX_CMD" ] && "$CODEX_CMD" mcp list 2>/dev/null | grep -q askuserquestionspro; }; then
    PRESERVE_SHARED=1
  fi
fi

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

printf '%s\n\n' "${C_BOLD}AskUserQuestionsPro kaldırma — Claude Code + Codex + Antigravity CLI (target: $TARGET)${C_RESET}"

collect_port_pids() {
  # Only the managed AskUserQuestionsPro runtime may be terminated. A foreign
  # process holding the same port is always preserved.
  PIDS=()
  FOREIGN_PIDS=()
  while IFS= read -r pid; do
    case "$pid" in
      ''|*[!0-9]*) ;;
      *)
        command_line=$(ps -p "$pid" -o command= 2>/dev/null || true)
        case "$command_line" in
          *"$INSTALL_DIR/server/server.js"*) PIDS[${#PIDS[@]}]="$pid" ;;
          *) FOREIGN_PIDS[${#FOREIGN_PIDS[@]}]="$pid" ;;
        esac
        ;;
    esac
  done < <(lsof -ti "tcp:$PORT" 2>/dev/null || true)
}

fallback_remove_mcp() {
  if [ "$CLAUDE_APPLIES" -eq 1 ]; then
    fallback_claude="${ASKUI_CLAUDE_BIN:-}"
    if [ -z "$fallback_claude" ] && command -v claude >/dev/null 2>&1; then
      fallback_claude=$(command -v claude)
    fi
    if [ -n "$fallback_claude" ] && [ -x "$fallback_claude" ]; then
      "$fallback_claude" mcp remove --scope user askuserquestionspro >/dev/null 2>&1 || true
      "$fallback_claude" mcp remove askuserquestionspro >/dev/null 2>&1 || true
      info "  Claude MCP fallback temizliği denendi"
    else
      warn "Claude CLI bulunamadı — MCP fallback temizliği çalıştırılamadı"
    fi
  fi
  if [ "$CODEX_APPLIES" -eq 1 ]; then
    fallback_codex=$(find_codex 2>/dev/null || true)
    if [ -n "$fallback_codex" ]; then
      "$fallback_codex" mcp remove askuserquestionspro >/dev/null 2>&1 || true
      info "  Codex MCP fallback temizliği denendi"
    else
      warn "Codex executable bulunamadı — MCP fallback temizliği çalıştırılamadı"
    fi
  fi
  if [ "$ANTIGRAVITY_APPLIES" -eq 1 ]; then
    if command -v node >/dev/null 2>&1 && [ -f "$ANTIGRAVITY_MCP_CONFIG" ]; then
      node -e '
        const fs = require("node:fs");
        const file = process.argv[1];
        try {
          const value = JSON.parse(fs.readFileSync(file, "utf8"));
          if (value && value.mcpServers && Object.prototype.hasOwnProperty.call(value.mcpServers, "askuserquestionspro")) {
            delete value.mcpServers.askuserquestionspro;
            if (Object.keys(value.mcpServers).length === 0) delete value.mcpServers;
            fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\\n", { mode: 0o600 });
          }
        } catch (_) {}
      ' "$ANTIGRAVITY_MCP_CONFIG" || true
      info "  Antigravity MCP fallback temizliği denendi"
    else
      warn "Antigravity MCP config bulunamadı — fallback temizliği atlandı"
    fi
  fi
}

# ── 1/5 Çalışan bridge süreçlerini kapat ────────────────────────────────────
step "1/5  Çalışan köprü süreçleri kapatılıyor (port $PORT)"
if [ "$PRESERVE_SHARED" -eq 1 ]; then
  info "  diğer host ortak bridge'i kullanabilir → süreç kapatma atlandı"
elif command -v lsof >/dev/null 2>&1; then
  collect_port_pids
  if [ "${#FOREIGN_PIDS[@]}" -gt 0 ]; then
    warn "yabancı port süreci korunuyor: ${FOREIGN_PIDS[*]}"
  fi
  if [ "${#PIDS[@]}" -gt 0 ]; then
    kill "${PIDS[@]}" 2>/dev/null && info "  SIGTERM → ${PIDS[*]}"
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      sleep 0.1
      collect_port_pids
      [ "${#PIDS[@]}" -eq 0 ] && break
    done
    collect_port_pids
    if [ "${#PIDS[@]}" -gt 0 ]; then
      kill -9 "${PIDS[@]}" 2>/dev/null && info "  SIGKILL → ${PIDS[*]}"
      sleep 0.2
    fi
    ok "süreç(ler) kapatıldı"
  else
    ok "çalışan süreç yok"
  fi
else
  warn "lsof yok — süreç kontrolü atlandı"
fi

# ── 2/5 Host kayıtlarını bundled CLI ile kaldır ──────────────────────────────
step "2/5  Claude/Codex/Antigravity hook, MCP ve plugin kayıtları kaldırılıyor (target: $TARGET)"
# Primer: bundled Node logic tüm host kayıtlarını idempotent kaldırır.
if [ -f "$INSTALL_DIR/bin/cli.js" ]; then
  if node "$INSTALL_DIR/bin/cli.js" uninstall --target "$TARGET"; then
    ok "bundled host temizliği tamamlandı"
  else
    warn "bundled host temizliği hata verdi — host CLI fallback'i deneniyor"
    fallback_remove_mcp
  fi
else
  warn "bundled CLI yok — host CLI fallback'i ve savunma kontrolleri kullanılacak"
  fallback_remove_mcp
fi
# Savunma amaçlı Claude jq süpürmesi: askuserquestionspro geçen TÜM PreToolUse
#     entry'lerini at (eski/farklı-path kurulumlardan kalıntı için), boş anahtarları buda.
if [ "$CLAUDE_APPLIES" -eq 1 ] && [ -f "$SETTINGS" ] && command -v jq >/dev/null 2>&1; then
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
elif [ "$CLAUDE_APPLIES" -eq 0 ]; then
  info "  Claude hedeflenmedi; settings hook süpürmesi atlandı"
elif [ -f "$INSTALL_DIR/bin/cli.js" ]; then
  ok "hook bundled logic ile kaldırıldı (jq yok)"
else
  warn "jq ve bundled logic yok — hook elle kontrol edilmeli: $SETTINGS"
fi

# MCP kaydı ayrıca elle değiştirilmez: farklı host konfigürasyonlarının tek sahibi
# bundled CLI'dır. Aşağıdaki kalıntı kontrolü host CLI'larıyla sonucu doğrular.

# ── 3/5 Dosyalar, UI ayarları, npm global ───────────────────────────────────
step "3/5  Dosyalar ve ayarlar siliniyor"
if [ "$PRESERVE_SHARED" -eq 1 ]; then
  info "  diğer host hâlâ kurulu → ortak runtime, UI ayarları ve npm paketi korunuyor"
else
  if rm -rf "$INSTALL_DIR"; then ok "silindi: $INSTALL_DIR"; else err "$INSTALL_DIR silinemedi"; FAIL=1; fi
  if rm -rf "$CONFIG_DIR"; then ok "silindi: $CONFIG_DIR (UI ayarları)"; else err "$CONFIG_DIR silinemedi"; FAIL=1; fi
  if command -v npm >/dev/null 2>&1; then
    npm uninstall -g askuserquestionspro >/dev/null 2>&1 || true
    info "  npm global temizlik denendi (varsa kaldırıldı)"
  fi
fi

# ── 4/5 Skill ───────────────────────────────────────────────────────────────
step "4/5  Host askpro skill/plugin'leri"
if [ "$KEEP_SKILL" -eq 1 ]; then
  info "  --keep-skill → host skill'leri korunuyor"
else
  if [ "$CLAUDE_APPLIES" -eq 1 ] && [ -d "$CLAUDE_SKILL_DIR" ]; then
    if rm -rf "$CLAUDE_SKILL_DIR"; then ok "silindi: $CLAUDE_SKILL_DIR"; else err "$CLAUDE_SKILL_DIR silinemedi"; FAIL=1; fi
  fi
  if [ "$CODEX_APPLIES" -eq 1 ] && [ -d "$CODEX_SKILL_DIR" ]; then
    if rm -rf "$CODEX_SKILL_DIR"; then ok "silindi: $CODEX_SKILL_DIR"; else err "$CODEX_SKILL_DIR silinemedi"; FAIL=1; fi
  fi
  if [ "$ANTIGRAVITY_APPLIES" -eq 1 ] && [ -d "$ANTIGRAVITY_PLUGIN_DIR" ]; then
    if rm -rf "$ANTIGRAVITY_PLUGIN_DIR"; then ok "silindi: $ANTIGRAVITY_PLUGIN_DIR"; else err "$ANTIGRAVITY_PLUGIN_DIR silinemedi"; FAIL=1; fi
  fi
fi

# ── Doğrulama (kalıntısızlık) ────────────────────────────────────────────────
step "5/5  Kalıntı kontrolü"
if [ "$PRESERVE_SHARED" -eq 1 ]; then
  if [ -d "$INSTALL_DIR" ]; then ok "ortak runtime korundu"; else err "ortak runtime yanlışlıkla silindi"; FAIL=1; fi
else
  if [ ! -d "$INSTALL_DIR" ]; then ok "dosyalar yok"; else err "kalıntı: $INSTALL_DIR"; FAIL=1; fi
  if [ ! -d "$CONFIG_DIR" ]; then ok "UI ayarları yok"; else err "kalıntı: $CONFIG_DIR"; FAIL=1; fi
fi
if [ "$KEEP_SKILL" -eq 1 ]; then
  info "  skill korundu (kontrol atlandı)"
else
  if [ "$CLAUDE_APPLIES" -eq 1 ] && [ -d "$CLAUDE_SKILL_DIR" ]; then
    err "kalıntı: $CLAUDE_SKILL_DIR"; FAIL=1
  elif [ "$CLAUDE_APPLIES" -eq 1 ]; then
    ok "Claude skill yok"
  fi
  if [ "$CODEX_APPLIES" -eq 1 ] && [ -d "$CODEX_SKILL_DIR" ]; then
    err "kalıntı: $CODEX_SKILL_DIR"; FAIL=1
  elif [ "$CODEX_APPLIES" -eq 1 ]; then
    ok "Codex skill yok"
  fi
  if [ "$ANTIGRAVITY_APPLIES" -eq 1 ] && [ -d "$ANTIGRAVITY_PLUGIN_DIR" ]; then
    err "kalıntı: $ANTIGRAVITY_PLUGIN_DIR"; FAIL=1
  elif [ "$ANTIGRAVITY_APPLIES" -eq 1 ]; then
    ok "Antigravity plugin yok"
  fi
fi
# Hook gerçekten gitti mi?
if [ "$CLAUDE_APPLIES" -eq 1 ] && [ -f "$SETTINGS" ] && command -v jq >/dev/null 2>&1; then
  if jq -e '[.. | objects | select(has("command")) | .command // "" | select(test("askuserquestionspro"))] | length > 0' "$SETTINGS" >/dev/null 2>&1; then
    err "kalıntı: settings.json'da hâlâ askuserquestionspro hook var"; FAIL=1
  else
    ok "hook yok"
  fi
elif [ "$CLAUDE_APPLIES" -eq 1 ] && [ -f "$SETTINGS" ] && grep -q askuserquestionspro "$SETTINGS"; then
  warn "settings.json'da askuserquestionspro geçiyor (jq yok — elle kontrol edin)"
else
  ok "hook yok"
fi
# Her ulaşılabilir host'ta MCP gitti mi?
if [ "$CLAUDE_APPLIES" -eq 1 ]; then
  CLAUDE_CMD="${ASKUI_CLAUDE_BIN:-}"
  if [ -z "$CLAUDE_CMD" ] && command -v claude >/dev/null 2>&1; then
    CLAUDE_CMD=$(command -v claude)
  fi
  if [ -n "$CLAUDE_CMD" ] && [ -x "$CLAUDE_CMD" ]; then
    if "$CLAUDE_CMD" mcp list 2>/dev/null | grep -q askuserquestionspro; then err "kalıntı: MCP hâlâ kayıtlı"; FAIL=1; else ok "MCP kaydı yok"; fi
  fi
fi
if [ "$CODEX_APPLIES" -eq 1 ]; then
  CODEX_CMD=$(find_codex 2>/dev/null || true)
  if [ -n "$CODEX_CMD" ]; then
    if "$CODEX_CMD" mcp list 2>/dev/null | grep -q askuserquestionspro; then
      err "kalıntı: Codex MCP hâlâ kayıtlı"; FAIL=1
    else
      ok "Codex MCP kaydı yok"
    fi
  else
    warn "Codex executable bulunamadı — MCP kalıntısı CLI üzerinden doğrulanamadı"
  fi
fi
if [ "$ANTIGRAVITY_APPLIES" -eq 1 ]; then
  if [ -f "$ANTIGRAVITY_MCP_CONFIG" ] && grep -q askuserquestionspro "$ANTIGRAVITY_MCP_CONFIG" 2>/dev/null; then
    warn "Antigravity mcp_config.json'da askuserquestionspro geçiyor — bundled CLI ile tekrar kontrol edin"
  else
    ok "Antigravity MCP kaydı yok"
  fi
fi
# Port boş mu?
if [ "$PRESERVE_SHARED" -eq 1 ]; then
  info "  ortak bridge korunuyor → portun açık kalması beklenir"
elif command -v lsof >/dev/null 2>&1; then
      collect_port_pids
      if [ "${#PIDS[@]}" -eq 0 ]; then
        if [ "${#FOREIGN_PIDS[@]}" -gt 0 ]; then warn "port $PORT yabancı süreç tarafından tutuluyor; dokunulmadı"; else ok "port $PORT boş"; fi
      else
        err "AskUserQuestionsPro port süreçleri hâlâ dolu: ${PIDS[*]}"; FAIL=1
      fi
fi

# ── Özet ─────────────────────────────────────────────────────────────────────
printf '\n'
if [ "$FAIL" -eq 0 ]; then
  printf '%s\n' "${C_BOLD}${C_GREEN}✓ Kaldırma tamamlandı — kalıntı yok.${C_RESET}"
else
  printf '%s\n' "${C_BOLD}${C_RED}✗ Kaldırma bitti ama bazı kalıntılar kaldı (yukarıya bakın).${C_RESET}"
fi
exit "$FAIL"
