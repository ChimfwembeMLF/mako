#!/usr/bin/env bash
# Load nvm + Corepack, then run a command with the repo Node/Yarn versions.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
elif command -v brew >/dev/null 2>&1; then
  BREW_NVM="$(brew --prefix nvm 2>/dev/null)/nvm.sh"
  if [ -s "$BREW_NVM" ]; then
    # shellcheck source=/dev/null
    . "$BREW_NVM"
  fi
fi

if command -v nvm >/dev/null 2>&1; then
  cd "$ROOT"
  nvm use
fi

if ! command -v node >/dev/null 2>&1; then
  cat >&2 <<'EOF'
Node.js is not available in this shell.

Install nvm, then Node 20:
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  source ~/.zshrc
  nvm install 20
  nvm use 20

Then re-run this script.
EOF
  exit 1
fi

corepack enable >/dev/null 2>&1 || true

cd "$ROOT"
exec "$@"
