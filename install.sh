#!/usr/bin/env bash
# askuserquestionspro — production-grade kurulum.
# GitHub'dan TAZE çeker (git clone, fallback curl-zip), kalıcı konuma kurar,
# hook + MCP kaydını repo'nun bundled Node logic'iyle yapar ve KESİN doğrular.
# npm KULLANMAZ. Idempotent: tekrar tekrar çalıştırılabilir.
set -euo pipefail

REPO_URL="https://github.com/ozkayhan/AskUserQuestionsPro"
BRANCH="main"
INSTALL_DIR="$HOME/.local/share/askuserquestionspro"
SETTINGS="$HOME/.claude/settings.json"
SKILL_DEST="$HOME/.claude/skills/askpro"

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

printf '%s\n\n' "${C_BOLD}AskUserQuestionsPro kurulumu${C_RESET}"

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

# ── 2/6 Kaynağı GitHub'dan çek ───────────────────────────────────────────────
CURRENT_STEP="kaynağı GitHub'dan çekme"
step "2/6  Kaynak GitHub'dan çekiliyor ($BRANCH)"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT
SRC=""
if [ "$HAVE_GIT" -eq 1 ]; then
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
  "lib/settings.js" "web/settings-schema.js"
)
for f in "${REQUIRED[@]}"; do
  [ -e "$SRC/$f" ] || die "eksik dosya: $f (yarım/bozuk indirme?)"
done
ok "tüm kritik dosyalar mevcut"

# ── 4/6 Kalıcı konuma kopyala ────────────────────────────────────────────────
CURRENT_STEP="dosyaların kalıcı konuma kopyalanması"
step "4/6  Dosyalar kuruluyor → $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
# Bayat içerik kalmasın diye kuruluma giren tüm alt dizinleri önce temizle.
for d in bin hooks web server lib mcp-server; do
  rm -rf "${INSTALL_DIR:?}/$d"
  [ -d "$SRC/$d" ] && cp -R "$SRC/$d" "$INSTALL_DIR/"
done
[ -f "$SRC/package.json" ] && cp "$SRC/package.json" "$INSTALL_DIR/"
[ -d "$INSTALL_DIR/bin" ] || die "kopyalama başarısız: $INSTALL_DIR/bin yok"
ok "dosyalar kopyalandı"

# ── 5/6 Hook + MCP kaydı + skill (bundled Node logic) ───────────────────────
CURRENT_STEP="hook, MCP ve skill kaydı"
step "5/6  Hook + MCP + skill kaydediliyor (bundled, atomic, jq'suz)"
mkdir -p "$HOME/.claude"
# cli.js kendi konumuna (INSTALL_DIR) göre path kurar → kalıcı yola işaret eder.
if ! node "$INSTALL_DIR/bin/cli.js" install; then
  die "hook/MCP kaydı başarısız. settings.json'da çakışan AskUserQuestion hook'u olabilir (#15897) — elle kontrol: $SETTINGS"
fi
ok "hook + MCP kaydı tamam"
# askpro skill'ini repo'dan deploy et (clone ile gelir). Yoksa uyar (eski main'de olmayabilir).
if [ -f "$SRC/skill/askpro/SKILL.md" ]; then
  mkdir -p "$HOME/.claude/skills"
  rm -rf "$SKILL_DEST"
  cp -R "$SRC/skill/askpro" "$SKILL_DEST"
  ok "askpro skill kuruldu → $SKILL_DEST"
else
  warn "skill kaynağı yok ($SRC/skill/askpro) — GitHub main'e henüz push edilmemiş olabilir; skill atlandı"
fi

# ── 6/6 Doğrulama ────────────────────────────────────────────────────────────
CURRENT_STEP="kurulum doğrulaması"
step "6/6  Kurulum doğrulanıyor"
VERIFY_FAIL=0

if [ -d "$INSTALL_DIR" ]; then ok "dosyalar: $INSTALL_DIR"; else err "dosyalar yok"; VERIFY_FAIL=1; fi

# Hook gerçekten settings.json'da mı? (jq varsa yapısal, yoksa grep)
if command -v jq >/dev/null 2>&1 && [ -f "$SETTINGS" ]; then
  if jq -e '.hooks.PreToolUse[]? | select(.matcher=="AskUserQuestion") | .hooks[]?.command | test("askuserquestionspro")' "$SETTINGS" >/dev/null 2>&1; then
    ok "hook: $SETTINGS"
  else
    err "hook settings.json'da bulunamadı"; VERIFY_FAIL=1
  fi
elif [ -f "$SETTINGS" ] && grep -q askuserquestionspro "$SETTINGS"; then
  ok "hook: $SETTINGS (grep)"
else
  err "hook doğrulanamadı"; VERIFY_FAIL=1
fi

# MCP kaydı (claude varsa). Yoksa bilgi amaçlı warn — hard-fail değil.
if command -v claude >/dev/null 2>&1; then
  if claude mcp list 2>/dev/null | grep -q askuserquestionspro; then
    ok "MCP aracı kayıtlı (mcp__askuserquestionspro__ask)"
  else
    warn "MCP kaydı görünmüyor — elle: claude mcp add --scope user askuserquestionspro -- node \"$INSTALL_DIR/mcp-server/askuserquestionspro-mcp.mjs\""
  fi
else
  warn "claude CLI yok — MCP durumu kontrol edilemedi"
fi

# Skill deploy edildi mi? (kaynak yoksa atlanmış olabilir → warn, hard-fail değil)
if [ -f "$SKILL_DEST/SKILL.md" ]; then
  ok "askpro skill: $SKILL_DEST"
else
  warn "askpro skill kurulmadı (kaynak GitHub main'de yoksa normal — push gerekir)"
fi

# Bundled doctor (bilgi amaçlı tam tanı).
info ""
info "doctor çıktısı:"
node "$INSTALL_DIR/bin/cli.js" doctor || true

[ "$VERIFY_FAIL" -eq 0 ] || die "doğrulama başarısız — yukarıdaki ✗ satırlarına bakın."

# ── Özet ─────────────────────────────────────────────────────────────────────
trap - ERR
printf '\n%s\n' "${C_BOLD}${C_GREEN}✓ Kurulum başarıyla tamamlandı.${C_RESET}"
cat <<EOF

  Kurulum yeri : $INSTALL_DIR
  Hook         : $SETTINGS (AskUserQuestion → AMOLED arayüz)
  MCP aracı    : mcp__askuserquestionspro__ask (sınırsız soru)

Yeni bir 'claude' oturumu açın:
  • ≤4 soru  → AskUserQuestion hook'u yerel arayüzü açar.
  • >4 soru  → model mcp__askuserquestionspro__ask aracını kullanır.

Tanı için: node "$INSTALL_DIR/bin/cli.js" doctor
EOF
