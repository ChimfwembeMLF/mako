#!/usr/bin/env bash
# Full migration: start Rust, smoke parity, cutover LiteSpeed to Rust, optionally retire NestJS.
#
# Usage (on production server):
#   sudo bash api-rust/scripts/migrate-everything.sh
#   RETIRE_NEST=true sudo bash api-rust/scripts/migrate-everything.sh
#
# Env:
#   RETIRE_NEST=false     stop Nest PM2 after cutover (default false)
#   SKIP_SMOKE=true       skip smoke parity gate
#   LITESPEED_VHOST_CONF  LiteSpeed vhost path

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/.." && pwd)"
cd "$REPO_ROOT"

NEST_PORT="${NEST_PORT:-4005}"
RUST_PORT="${RUST_PORT:-4006}"
RETIRE_NEST="${RETIRE_NEST:-false}"
SKIP_SMOKE="${SKIP_SMOKE:-false}"

echo "==> Step 1: Deploy Rust API"
bash "$ROOT/scripts/dual-run-start.sh"

if [[ "$SKIP_SMOKE" != "true" ]]; then
  echo "==> Step 2: Final smoke parity"
  RUST_BASE="http://127.0.0.1:${RUST_PORT}" \
  NEST_BASE="http://127.0.0.1:${NEST_PORT}" \
    bash "$ROOT/scripts/smoke-parity.sh"
else
  echo "==> Step 2: Skipping smoke (SKIP_SMOKE=true)"
fi

echo "==> Step 3: LiteSpeed full cutover (/api, /uploads, /documentation, /admin → Rust)"
if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
  bash "$ROOT/scripts/cutover-proxy-to-rust.sh" full
else
  echo "Not root — run manually:"
  echo "  sudo bash api-rust/scripts/cutover-proxy-to-rust.sh full"
  exit 1
fi

echo "==> Step 4: Verify public health"
sleep 2
curl -sf "https://mako.tekreminnovations.com/api/v1/health" | head -c 300 || {
  echo "Public health check failed — verify LiteSpeed vhost and PM2"
  exit 1
}
echo ""

if [[ "$RETIRE_NEST" == "true" ]]; then
  bash "$ROOT/scripts/retire-nest-api.sh"
else
  cat <<EOF

Migration cutover complete. NestJS still running on :${NEST_PORT} as fallback.

To retire NestJS when stable:
  RETIRE_NEST=true sudo bash api-rust/scripts/migrate-everything.sh
  # or:
  bash api-rust/scripts/retire-nest-api.sh

Monitor:
  pm2 logs "Mako API Rust" --lines 50
  RUST_BASE=https://mako.tekreminnovations.com NEST_BASE=http://127.0.0.1:${NEST_PORT} api-rust/scripts/smoke-parity.sh
EOF
fi
