#!/usr/bin/env bash
# askuserquestionspro — reinstall orkestratörü.
# ÖNCE uninstall (kesin bitene kadar bekler), SONRA install. Tek script.
# Claude Code, Codex App/CLI ve Antigravity CLI hedefini iki aşamaya da aynen taşır.
# Yerel sibling script'leri kullanır; yoksa immutable release tag + SHA-256 ile indirir.
set -euo pipefail

REPO_URL="https://github.com/ozkayhan/AskUserQuestionsPro"
RELEASE_TAG="${ASKUSER_RELEASE_TAG:-}"
RELEASE_SHA256="${ASKUSER_RELEASE_SHA256:-}"
INSTALL_SHA256="${ASKUSER_INSTALL_SHA256:-}"
UNINSTALL_SHA256="${ASKUSER_UNINSTALL_SHA256:-}"
TARGET="${ASKUSER_TARGET:-auto}"

usage() {
  cat <<'EOF'
Kullanım: reinstall.sh [--target auto|all|claude|codex|antigravity]
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

if [ -t 1 ]; then
  C_RESET=$'\033[0m'; C_RED=$'\033[31m'; C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'; C_BLUE=$'\033[34m'; C_BOLD=$'\033[1m'
else
  C_RESET=; C_RED=; C_GREEN=; C_YELLOW=; C_BLUE=; C_BOLD=
fi
step() { printf '%s\n' "${C_BOLD}${C_BLUE}━━ $*${C_RESET}"; }
warn() { printf '%s\n' "${C_YELLOW}⚠ $*${C_RESET}"; }
die()  { printf '%s\n' "${C_RED}✗ $*${C_RESET}" >&2; exit 1; }

# Yerel sibling'ler mi, yoksa GitHub'dan indir mi?
if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
  DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi
UNINSTALL_SH=""; INSTALL_SH=""; REMOTE_MODE=0
if [ -n "${DIR:-}" ] && [ -f "$DIR/uninstall.sh" ] && [ -f "$DIR/install.sh" ]; then
  UNINSTALL_SH="$DIR/uninstall.sh"; INSTALL_SH="$DIR/install.sh"
else
  REMOTE_MODE=1
  command -v curl >/dev/null 2>&1 || die "curl yok ve yerel script'ler bulunamadı."
  [ -n "$RELEASE_TAG" ] || die "Uzak reinstall için ASKUSER_RELEASE_TAG zorunludur."
  [ -n "$RELEASE_SHA256" ] || die "Uzak reinstall için ASKUSER_RELEASE_SHA256 zorunludur."
  [ -n "$INSTALL_SHA256" ] || die "Uzak reinstall için ASKUSER_INSTALL_SHA256 zorunludur."
  [ -n "$UNINSTALL_SHA256" ] || die "Uzak reinstall için ASKUSER_UNINSTALL_SHA256 zorunludur."
  case "$RELEASE_TAG" in
    *[!A-Za-z0-9._-]*) die "Geçersiz release tag: $RELEASE_TAG" ;;
  esac
  if command -v sha256sum >/dev/null 2>&1; then
    hash_file() { sha256sum "$1" | awk '{print $1}'; }
  elif command -v shasum >/dev/null 2>&1; then
    hash_file() { shasum -a 256 "$1" | awk '{print $1}'; }
  else
    die "sha256sum veya shasum bulunamadı."
  fi
  WORKDIR="$(mktemp -d)"; trap 'rm -rf "$WORKDIR"' EXIT
  for s in uninstall install; do
    curl -fsSL -o "$WORKDIR/$s.sh" "$REPO_URL/raw/refs/tags/$RELEASE_TAG/$s.sh" || die "$s.sh indirilemedi."
    [ -s "$WORKDIR/$s.sh" ] || die "$s.sh boş indirildi."
  done
  [ "$(hash_file "$WORKDIR/install.sh")" = "$INSTALL_SHA256" ] || die "install.sh checksum eşleşmedi."
  [ "$(hash_file "$WORKDIR/uninstall.sh")" = "$UNINSTALL_SHA256" ] || die "uninstall.sh checksum eşleşmedi."
  UNINSTALL_SH="$WORKDIR/uninstall.sh"; INSTALL_SH="$WORKDIR/install.sh"
fi

printf '%s\n\n' "${C_BOLD}AskUserQuestionsPro yeniden kurulumu — Claude Code + Codex + Antigravity CLI (target: $TARGET)${C_RESET}"

step "Aşama 1/2 — KALDIRMA (skill dahil tam temizlik)"
# uninstall hata dönse bile (örn. kapanmayan süreç) install idempotent olduğu için devam et.
if bash "$UNINSTALL_SH" --target "$TARGET"; then
  printf '\n'
else
  warn "uninstall bazı kalıntılarla bitti — install üzerine yazacağı için devam ediliyor."
  printf '\n'
fi

if [ -n "${DIR:-}" ] && [ "$INSTALL_SH" = "$DIR/install.sh" ]; then
  step "Aşama 2/2 — KURULUM (yerel doğrulanmış kaynak)"
else
  step "Aşama 2/2 — KURULUM (immutable release $RELEASE_TAG)"
fi
if [ "$REMOTE_MODE" -eq 1 ]; then
  ASKUSER_RELEASE_TAG="$RELEASE_TAG" \
    ASKUSER_RELEASE_SHA256="$RELEASE_SHA256" \
    bash "$INSTALL_SH" --target "$TARGET" || die "install başarısız — yukarıdaki hataya bakın."
else
  bash "$INSTALL_SH" --target "$TARGET" || die "install başarısız — yukarıdaki hataya bakın."
fi

printf '\n%s\n' "${C_BOLD}${C_GREEN}✓ Yeniden kurulum tamamlandı. Yeni bir Claude Code, Codex/ChatGPT Desktop veya Antigravity CLI oturumu açın.${C_RESET}"
