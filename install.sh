#!/usr/bin/env bash
# askuserquestionspro — production-grade kurulum.
# GitHub'dan immutable release tag + SHA-256 ile çeker, staging dizinine kurar,
# Claude Code, Codex ve/veya Antigravity CLI için hook + MCP kaydını bundled Node logic'iyle yapar
# ve KESİN doğrular.
# npm KULLANMAZ. Idempotent: tekrar tekrar çalıştırılabilir.
set -euo pipefail

REPO_URL="https://github.com/ozkayhan/AskUserQuestionsPro"
RELEASE_TAG="${ASKUSER_RELEASE_TAG:-v1.4.0}"
RELEASE_SHA256="${ASKUSER_RELEASE_SHA256:-}"
INSTALL_DIR="$HOME/.local/share/askuserquestionspro"
CLAUDE_SKILL_DEST="$HOME/.claude/skills/askpro"
CODEX_SKILL_DEST="$HOME/.agents/skills/askpro"
ANTIGRAVITY_PLUGIN_DEST="$HOME/.gemini/antigravity-cli/plugins/askuserquestionspro"
TARGET="${ASKUSER_TARGET:-auto}"
SOURCE_OVERRIDE="${ASKUSER_SOURCE_DIR:-}"

usage() {
  cat <<'EOF'
Kullanım: install.sh [--target auto|all|claude|codex|antigravity]

  auto    Kurulu Claude Code, Codex/ChatGPT Desktop ve Antigravity CLI yüzeylerini keşfeder (varsayılan)
  all     Claude Code, Codex ve Antigravity CLI'nin üçünü de yapılandırır
  claude  Yalnız Claude Code'u yapılandırır
  codex   Yalnız Codex App/CLI ve ChatGPT Desktop'ı yapılandırır
  antigravity  Yalnız Antigravity CLI'yi yapılandırır
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
  auto|all|claude|codex|antigravity) ;;
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

antigravity_is_available() {
  if [ -n "${ASKUI_ANTIGRAVITY_BIN:-}" ]; then
    [ -x "$ASKUI_ANTIGRAVITY_BIN" ]
    return $?
  fi
  command -v agy >/dev/null 2>&1 && return 0
  [ -x "$HOME/.local/bin/agy" ] || [ -x "$HOME/.gemini/antigravity-cli/bin/agy" ]
}

CLAUDE_SELECTED=0
CODEX_SELECTED=0
ANTIGRAVITY_SELECTED=0
case "$TARGET" in
  all) CLAUDE_SELECTED=1; CODEX_SELECTED=1; ANTIGRAVITY_SELECTED=1 ;;
  claude) CLAUDE_SELECTED=1 ;;
  codex) CODEX_SELECTED=1 ;;
  antigravity) ANTIGRAVITY_SELECTED=1 ;;
  auto)
    claude_is_available && CLAUDE_SELECTED=1
    codex_is_available && CODEX_SELECTED=1
    antigravity_is_available && ANTIGRAVITY_SELECTED=1
    # Bundled CLI da host bulunmadığında geriye uyumluluk için Claude dosyalarını hazırlar.
    if [ "$CLAUDE_SELECTED" -eq 0 ] && [ "$CODEX_SELECTED" -eq 0 ] && [ "$ANTIGRAVITY_SELECTED" -eq 0 ]; then
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

printf '%s\n\n' "${C_BOLD}AskUserQuestionsPro kurulumu — Claude Code + Codex + Antigravity CLI (target: $TARGET)${C_RESET}"

# ── 1/6 Preflight ───────────────────────────────────────────────────────────
CURRENT_STEP="ön koşul kontrolü"
step "1/6  Ön koşullar kontrol ediliyor"
command -v node >/dev/null 2>&1 || die "node bulunamadı. Node.js kurun: https://nodejs.org"
NODE_VERSION="$(node --version)"
NODE_MAJOR="${NODE_VERSION#v}"
NODE_MAJOR="${NODE_MAJOR%%.*}"
case "$NODE_MAJOR" in
  ''|*[!0-9]*) die "Node.js sürümü okunamadı: $NODE_VERSION" ;;
esac
[ "$NODE_MAJOR" -ge 18 ] || die "Node.js 18+ gerekli; bulunan: $NODE_VERSION"
ok "node $NODE_VERSION (18+ doğrulandı)"
if [ -z "$SOURCE_OVERRIDE" ]; then
  command -v curl >/dev/null 2>&1 || die "curl bulunamadı. Immutable release indirmek için curl gerekli."
  command -v unzip >/dev/null 2>&1 || die "unzip bulunamadı. Immutable release açmak için unzip gerekli."
  [ -n "$RELEASE_SHA256" ] || die "Uzak kurulumda ASKUSER_RELEASE_SHA256 zorunludur."
  if ! command -v sha256sum >/dev/null 2>&1 && ! command -v shasum >/dev/null 2>&1; then
    die "sha256sum veya shasum bulunamadı; release checksum doğrulanamıyor."
  fi
  case "$RELEASE_TAG" in
    *[!A-Za-z0-9._-]*) die "Geçersiz release tag: $RELEASE_TAG" ;;
  esac
fi

# ── 2/6 Kaynağı GitHub'dan çek veya yerel kaynaktan kur ─────────────────────
CURRENT_STEP="kaynağı GitHub'dan çekme"
if [ -n "$SOURCE_OVERRIDE" ]; then
  step "2/6  Yerel kaynak kullanılıyor ($SOURCE_OVERRIDE)"
else
  step "2/6  Kaynak immutable release'ten çekiliyor ($RELEASE_TAG)"
fi
WORKDIR="$(mktemp -d)"
STAGING_DIR=""
trap 'rm -rf "$WORKDIR" "${STAGING_DIR:-}"' EXIT
SRC=""
if [ -n "$SOURCE_OVERRIDE" ]; then
  [ -d "$SOURCE_OVERRIDE" ] || die "yerel kaynak dizini yok: $SOURCE_OVERRIDE"
  SRC="$(cd "$SOURCE_OVERRIDE" && pwd)"
  ok "yerel kaynak hazır"
else
  curl -fsSL "$REPO_URL/archive/refs/tags/$RELEASE_TAG.zip" -o "$WORKDIR/repo.zip" \
    || die "release zip indirilemedi ($REPO_URL/$RELEASE_TAG)."
  [ -s "$WORKDIR/repo.zip" ] || die "indirilen zip boş."
  if command -v sha256sum >/dev/null 2>&1; then
    ACTUAL_SHA256="$(sha256sum "$WORKDIR/repo.zip")"
    ACTUAL_SHA256="${ACTUAL_SHA256%% *}"
  else
    ACTUAL_SHA256="$(shasum -a 256 "$WORKDIR/repo.zip")"
    ACTUAL_SHA256="${ACTUAL_SHA256%% *}"
  fi
  [ "$ACTUAL_SHA256" = "$RELEASE_SHA256" ] || die "release checksum eşleşmedi. Beklenen: $RELEASE_SHA256, bulunan: $ACTUAL_SHA256"
  ok "release checksum doğrulandı"
  unzip -q "$WORKDIR/repo.zip" -d "$WORKDIR" || die "zip açılamadı."
  SRC="$WORKDIR/AskUserQuestionsPro-${RELEASE_TAG#v}"
  [ -d "$SRC" ] || die "release arşivi beklenen kaynak dizinini içermiyor: $SRC"
  ok "immutable release açıldı"
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

# ── 4/6 Staging + atomic swap ────────────────────────────────────────────────
CURRENT_STEP="dosyaların kalıcı konuma kopyalanması"
step "4/6  Bundle staging dizinine hazırlanıyor"
INSTALL_PARENT="$(dirname "$INSTALL_DIR")"
mkdir -p "$INSTALL_PARENT"
STAGING_DIR="$(mktemp -d "$INSTALL_DIR.staging.XXXXXX")"
for d in bin hooks web server lib mcp-server skill; do
  [ -d "$SRC/$d" ] && cp -R "$SRC/$d" "$STAGING_DIR/"
done
[ -f "$SRC/package.json" ] && cp "$SRC/package.json" "$STAGING_DIR/"
[ -d "$STAGING_DIR/bin" ] || die "staging kopyalama başarısız: $STAGING_DIR/bin yok"
[ -f "$STAGING_DIR/package.json" ] || die "staging manifest eksik"
ok "bundle staging'e kopyalandı"

ROLLBACK_DIR="$INSTALL_DIR.rollback.$$"
rm -rf "$ROLLBACK_DIR"
if [ -e "$INSTALL_DIR" ]; then mv "$INSTALL_DIR" "$ROLLBACK_DIR"; fi
if ! mv "$STAGING_DIR" "$INSTALL_DIR"; then
  if [ -e "$ROLLBACK_DIR" ]; then mv "$ROLLBACK_DIR" "$INSTALL_DIR"; fi
  die "staging bundle atomic olarak etkinleştirilemedi"
fi
STAGING_DIR=""

rollback_install() {
  rm -rf "$INSTALL_DIR"
  if [ -e "$ROLLBACK_DIR" ]; then mv "$ROLLBACK_DIR" "$INSTALL_DIR"; fi
}

# ── 5/6 Hook + MCP kaydı + skill (bundled Node logic) ───────────────────────
CURRENT_STEP="hook, MCP ve skill kaydı"
step "5/6  Claude/Codex/Antigravity MCP, hook ve skill kaydediliyor (target: $TARGET)"
# cli.js kendi konumuna (INSTALL_DIR) göre path kurar → kalıcı yola işaret eder.
if ! node "$INSTALL_DIR/bin/cli.js" install --target "$TARGET"; then
  rollback_install
  die "host kaydı başarısız. Tanı: node \"$INSTALL_DIR/bin/cli.js\" doctor --target \"$TARGET\""
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
if [ "$ANTIGRAVITY_SELECTED" -eq 1 ]; then
  if [ -f "$ANTIGRAVITY_PLUGIN_DEST/plugin.json" ] && [ -f "$ANTIGRAVITY_PLUGIN_DEST/skills/askpro/SKILL.md" ]; then
    ok "Antigravity CLI plugin: $ANTIGRAVITY_PLUGIN_DEST"
  else
    err "Antigravity CLI plugin doğrulanamadı"; VERIFY_FAIL=1
  fi
fi

if [ "$VERIFY_FAIL" -ne 0 ]; then
  rollback_install
  die "doğrulama başarısız — önceki kurulum geri yüklendi."
fi
rm -rf "$ROLLBACK_DIR"

# ── Özet ─────────────────────────────────────────────────────────────────────
trap - ERR
printf '\n%s\n' "${C_BOLD}${C_GREEN}✓ Kurulum başarıyla tamamlandı.${C_RESET}"
cat <<EOF

  Kurulum yeri : $INSTALL_DIR
  Target       : $TARGET
  Claude skill       : $CLAUDE_SKILL_DEST
  Codex skill        : $CODEX_SKILL_DEST
  Antigravity plugin : $ANTIGRAVITY_PLUGIN_DEST
  MCP aracı          : mcp__askuserquestionspro__ask (sınırsız soru)

Yeni bir Claude Code, Codex/ChatGPT Desktop veya Antigravity CLI oturumu açın.
Claude Code'da AskUserQuestion hook'u; tüm host'larda askpro skill ve MCP aracı kullanılabilir.

Tanı için: node "$INSTALL_DIR/bin/cli.js" doctor --target "$TARGET"
EOF
