#!/usr/bin/env bash
# askuserquestionspro — production-grade kurulum.
# GitHub'dan TAZE çeker (git clone, fallback curl-zip), kalıcı konuma kurar,
# Claude Code ve/veya Codex için hook + MCP kaydını bundled Node logic'iyle yapar
# ve KESİN doğrular.
# npm KULLANMAZ. Idempotent: tekrar tekrar çalıştırılabilir.
set -euo pipefail

REPO_URL="https://github.com/ozkayhan/AskUserQuestionsPro"
BRANCH="main"
INSTALL_DIR="$HOME/.local/share/askuserquestionspro"
CLAUDE_SKILL_DEST="$HOME/.claude/skills/askpro"
CODEX_SKILL_DEST="$HOME/.agents/skills/askpro"
TARGET="${ASKUSER_TARGET:-auto}"

usage() {
  cat <<'EOF'
Kullanım: install.sh [--target auto|all|claude|codex]

  auto    Kurulu Claude Code ve Codex/ChatGPT Desktop yüzeylerini keşfeder (varsayılan)
  all     Claude Code ve Codex'in ikisini de yapılandırır
  claude  Yalnız Claude Code'u yapılandırır
  codex   Yalnız Codex App/CLI ve ChatGPT Desktop'ı yapılandırır
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
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
  auto|all|claude|codex) ;;
  *) printf 'Geçersiz target: %s\n' "$TARGET" >&2; usage >&2; exit 2 ;;
esac

claude_is_available() {
  if [ -n "${ASKUI_CLAUDE_BIN:-}" ]; then
    [ -x "$ASKUI_CLAUDE_BIN" ]
    return $?
  fi
  command -v claude >/dev/null 2>&1
}

codex_is_available() {
  if [ -n "${ASKUI_CODEX_BIN:-}" ]; then
    [ -x "$ASKUI_CODEX_BIN" ]
    return $?
  fi
  command -v codex >/dev/null 2>&1 && return 0
  for candidate in \
    "/Applications/ChatGPT.app/Contents/Resources/codex" \
    "/Applications/Codex.app/Contents/Resources/codex" \
    "$HOME/Applications/ChatGPT.app/Contents/Resources/codex" \
    "$HOME/Applications/Codex.app/Contents/Resources/codex"
  do
    [ -x "$candidate" ] && return 0
  done
  return 1
}

CLAUDE_SELECTED=0
CODEX_SELECTED=0
case "$TARGET" in
  all) CLAUDE_SELECTED=1; CODEX_SELECTED=1 ;;
  claude) CLAUDE_SELECTED=1 ;;
  codex) CODEX_SELECTED=1 ;;
  auto)
    claude_is_available && CLAUDE_SELECTED=1
    codex_is_available && CODEX_SELECTED=1
    # Bundled CLI da host bulunmadığında geriye uyumluluk için Claude dosyalarını hazırlar.
    if [ "$CLAUDE_SELECTED" -eq 0 ] && [ "$CODEX_SELECTED" -eq 0 ]; then
      CLAUDE_SELECTED=1
    fi
    ;;
esac

# ── log helper'ları (TTY değilse renksiz) ───────────────────────────────────
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
die()  { err "$*"; exit 1; }

# Hangi adımda patladığını bildir (ERR trap).
CURRENT_STEP="başlangıç"
trap 'err "Kurulum \"$CURRENT_STEP\" adımında başarısız oldu (satır $LINENO)."' ERR

printf '%s\n\n' "${C_BOLD}AskUserQuestionsPro kurulumu — Claude Code + Codex (target: $TARGET)${C_RESET}"

# ── 1/6 Preflight ───────────────────────────────────────────────────────────
CURRENT_STEP="ön koşul kontrolü"
step "1/6  Ön koşullar kontrol ediliyor"
command -v node >/dev/null 2>&1 || die "node bulunamadı. Node.js kurun: https://nodejs.org"
ok "node $(node --version)"
HAVE_GIT=0; command -v git >/dev/null 2>&1 && HAVE_GIT=1
HAVE_ZIP=0; { command -v curl >/dev/null 2>&1 && command -v unzip >/dev/null 2>&1; } && HAVE_ZIP=1
if [ "$HAVE_GIT" -eq 0 ] && [ "$HAVE_ZIP" -eq 0 ]; then
  die "git de (curl+unzip) de yok. En az biri gerekli."
fi
if [ "$HAVE_GIT" -eq 1 ]; then ok "git mevcut"; else warn "git yok — curl-zip fallback kullanılacak"; fi

# ── 2/6 Kaynağı GitHub'dan çek veya yerel kaynaktan kur ─────────────────────
CURRENT_STEP="kaynağı GitHub'dan çekme"
SOURCE_OVERRIDE="${ASKUSER_SOURCE_DIR:-}"
if [ -n "$SOURCE_OVERRIDE" ]; then
  step "2/6  Yerel kaynak kullanılıyor ($SOURCE_OVERRIDE)"
else
  step "2/6  Kaynak GitHub'dan çekiliyor ($BRANCH)"
fi
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT
SRC=""
if [ -n "$SOURCE_OVERRIDE" ]; then
  [ -d "$SOURCE_OVERRIDE" ] || die "yerel kaynak dizini yok: $SOURCE_OVERRIDE"
  SRC="$(cd "$SOURCE_OVERRIDE" && pwd)"
  ok "yerel kaynak hazır"
elif [ "$HAVE_GIT" -eq 1 ]; then
  if git clone --depth 1 --branch "$BRANCH" "$REPO_URL.git" "$WORKDIR/src" >/dev/null 2>&1; then
    SRC="$WORKDIR/src"
    ok "git clone tamam"
  else
    warn "git clone başarısız — curl-zip fallback deneniyor"
  fi
fi
if [ -z "$SRC" ]; then
  [ "$HAVE_ZIP" -eq 1 ] || die "git clone başarısız ve curl/unzip yok."
  curl -fsSL "$REPO_URL/archive/refs/heads/$BRANCH.zip" -o "$WORKDIR/repo.zip" \
    || die "zip indirilemedi ($REPO_URL)."
  [ -s "$WORKDIR/repo.zip" ] || die "indirilen zip boş."
  unzip -q "$WORKDIR/repo.zip" -d "$WORKDIR" || die "zip açılamadı."
  SRC="$WORKDIR/AskUserQuestionsPro-$BRANCH"
  ok "curl-zip tamam"
fi

# ── 3/6 Sağlamlık kontrolü ───────────────────────────────────────────────────
CURRENT_STEP="çekilen kaynağın doğrulanması"
step "3/6  Çekilen kaynak doğrulanıyor"
[ -d "$SRC" ] || die "kaynak dizini yok: $SRC"
REQUIRED=(
  "bin/cli.js" "bin/install.js"
  "hooks/askuserquestionspro-bridge.mjs"
  "mcp-server/askuserquestionspro-mcp.mjs"
  "lib/settings.js" "web/settings-schema.js" "skill/askpro/SKILL.md"
)
for f in "${REQUIRED[@]}"; do
  [ -e "$SRC/$f" ] || die "eksik dosya: $f (yarım/bozuk indirme?)"
done
ok "tüm kritik dosyalar mevcut"

# Never use the live install directory as its own source. Without this guard,
# a recovery command such as ASKUSER_SOURCE_DIR="$INSTALL_DIR" would delete
# the source tree in step 4 before it had anything to copy.
case "$SRC/" in
  "$INSTALL_DIR"|"$INSTALL_DIR"/*)
    die "yerel kaynak kurulum dizininin içinde; ayrı bir checkout belirtin: $INSTALL_DIR"
    ;;
esac
case "$INSTALL_DIR/" in
  "$SRC"|"$SRC"/*)
    die "kurulum dizini yerel kaynağın içinde; ayrı bir install path belirtin: $SRC"
    ;;
esac

# ── 4/6 Kalıcı konuma kopyala ────────────────────────────────────────────────
CURRENT_STEP="dosyaların kalıcı konuma kopyalanması"
step "4/6  Dosyalar kuruluyor → $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
# Bayat içerik kalmasın diye kuruluma giren tüm alt dizinleri önce temizle.
for d in bin hooks web server lib mcp-server skill; do
  rm -rf "${INSTALL_DIR:?}/$d"
  [ -d "$SRC/$d" ] && cp -R "$SRC/$d" "$INSTALL_DIR/"
done
[ -f "$SRC/package.json" ] && cp "$SRC/package.json" "$INSTALL_DIR/"
[ -d "$INSTALL_DIR/bin" ] || die "kopyalama başarısız: $INSTALL_DIR/bin yok"
ok "dosyalar kopyalandı"

# ── 5/6 Hook + MCP kaydı + skill (bundled Node logic) ───────────────────────
CURRENT_STEP="hook, MCP ve skill kaydı"
step "5/6  Claude/Codex MCP, hook ve skill kaydediliyor (target: $TARGET)"
# cli.js kendi konumuna (INSTALL_DIR) göre path kurar → kalıcı yola işaret eder.
if ! node "$INSTALL_DIR/bin/cli.js" install --target "$TARGET"; then
  die "Claude/Codex kaydı başarısız. Tanı: node \"$INSTALL_DIR/bin/cli.js\" doctor --target \"$TARGET\""
fi
ok "bundled host kaydı tamam"

# Bundled CLI skill'i kalıcı paketteki `skill/askpro` kaynağından ilgili host
# dizinine deploy eder; shell katmanı yalnız doğrular.
# ── 6/6 Doğrulama ────────────────────────────────────────────────────────────
CURRENT_STEP="kurulum doğrulaması"
step "6/6  Kurulum doğrulanıyor"
VERIFY_FAIL=0

if [ -d "$INSTALL_DIR" ]; then ok "dosyalar: $INSTALL_DIR"; else err "dosyalar yok"; VERIFY_FAIL=1; fi

# Bundled doctor seçilen/keşfedilen her host'un hook/MCP kaydını denetler.
info ""
info "doctor çıktısı:"
if node "$INSTALL_DIR/bin/cli.js" doctor --target "$TARGET"; then
  ok "host doğrulaması tamam (target: $TARGET)"
else
  err "host doğrulaması başarısız (target: $TARGET)"; VERIFY_FAIL=1
fi

if [ "$CLAUDE_SELECTED" -eq 1 ]; then
  if [ -f "$CLAUDE_SKILL_DEST/SKILL.md" ]; then
    ok "Claude Code skill: $CLAUDE_SKILL_DEST"
  else
    err "Claude Code skill doğrulanamadı"; VERIFY_FAIL=1
  fi
fi
if [ "$CODEX_SELECTED" -eq 1 ]; then
  if [ -f "$CODEX_SKILL_DEST/SKILL.md" ]; then
    ok "Codex/ChatGPT Desktop skill: $CODEX_SKILL_DEST"
  else
    err "Codex/ChatGPT Desktop skill doğrulanamadı"; VERIFY_FAIL=1
  fi
fi

[ "$VERIFY_FAIL" -eq 0 ] || die "doğrulama başarısız — yukarıdaki ✗ satırlarına bakın."

# ── Özet ─────────────────────────────────────────────────────────────────────
trap - ERR
printf '\n%s\n' "${C_BOLD}${C_GREEN}✓ Kurulum başarıyla tamamlandı.${C_RESET}"
cat <<EOF

  Kurulum yeri : $INSTALL_DIR
  Target       : $TARGET
  Claude skill : $CLAUDE_SKILL_DEST
  Codex skill  : $CODEX_SKILL_DEST
  MCP aracı    : mcp__askuserquestionspro__ask (sınırsız soru, Claude + Codex)

Yeni bir Claude Code veya Codex/ChatGPT Desktop oturumu açın.
Claude Code'da AskUserQuestion hook'u; tüm host'larda askpro skill ve MCP aracı kullanılabilir.

Tanı için: node "$INSTALL_DIR/bin/cli.js" doctor --target "$TARGET"
EOF
