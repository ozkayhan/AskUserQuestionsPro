#!/usr/bin/env bash
# askuserquestionspro — reinstall orkestratörü.
# ÖNCE uninstall (kesin bitene kadar bekler), SONRA install. Tek script.
# Claude Code ve Codex App/CLI hedefini iki aşamaya da aynen taşır.
# Yerel sibling script'leri kullanır; yoksa (curl|bash) GitHub'dan indirir.
set -euo pipefail

REPO_URL="https://github.com/ozkayhan/AskUserQuestionsPro"
BRANCH="main"
TARGET="${ASKUSER_TARGET:-auto}"

usage() {
  cat <<'EOF'
Kullanım: reinstall.sh [--target auto|all|claude|codex]
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
UNINSTALL_SH=""; INSTALL_SH=""
if [ -n "${DIR:-}" ] && [ -f "$DIR/uninstall.sh" ] && [ -f "$DIR/install.sh" ]; then
  UNINSTALL_SH="$DIR/uninstall.sh"; INSTALL_SH="$DIR/install.sh"
else
  command -v curl >/dev/null 2>&1 || die "curl yok ve yerel script'ler bulunamadı."
  WORKDIR="$(mktemp -d)"; trap 'rm -rf "$WORKDIR"' EXIT
  for s in uninstall install; do
    curl -fsSL -o "$WORKDIR/$s.sh" "$REPO_URL/raw/$BRANCH/$s.sh" || die "$s.sh indirilemedi."
    [ -s "$WORKDIR/$s.sh" ] || die "$s.sh boş indirildi."
  done
  UNINSTALL_SH="$WORKDIR/uninstall.sh"; INSTALL_SH="$WORKDIR/install.sh"
fi

printf '%s\n\n' "${C_BOLD}AskUserQuestionsPro yeniden kurulumu — Claude Code + Codex (target: $TARGET)${C_RESET}"

step "Aşama 1/2 — KALDIRMA (skill dahil tam temizlik)"
# uninstall hata dönse bile (örn. kapanmayan süreç) install idempotent olduğu için devam et.
if bash "$UNINSTALL_SH" --target "$TARGET"; then
  printf '\n'
else
  warn "uninstall bazı kalıntılarla bitti — install üzerine yazacağı için devam ediliyor."
  printf '\n'
fi

step "Aşama 2/2 — KURULUM (GitHub $BRANCH'den taze)"
bash "$INSTALL_SH" --target "$TARGET" || die "install başarısız — yukarıdaki hataya bakın."

printf '\n%s\n' "${C_BOLD}${C_GREEN}✓ Yeniden kurulum tamamlandı. Yeni bir Claude Code veya Codex/ChatGPT Desktop oturumu açın.${C_RESET}"
