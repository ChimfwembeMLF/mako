#!/usr/bin/env bash
# Start Rust API alongside NestJS and verify both backends before LiteSpeed cutover.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NEST_PORT="${NEST_PORT:-4005}"
RUST_PORT="${RUST_PORT:-4006}"
RUN_SMOKE="${RUN_SMOKE:-true}"

echo "==> Deploying Rust API (PM2, port $RUST_PORT)"
bash "$ROOT/scripts/deploy-production.sh"

echo "==> Checking NestJS on :$NEST_PORT"
if ! curl -sf "http://127.0.0.1:${NEST_PORT}/api/v1/health" >/dev/null; then
  echo "NestJS not healthy on :$NEST_PORT — start with: cd api && yarn deploy:prod"
  exit 1
fi
echo "    NestJS OK"

echo "==> Checking Rust on :$RUST_PORT"
curl -sf "http://127.0.0.1:${RUST_PORT}/api/v1/health" | head -c 200
echo ""
echo "    Rust OK"

if [[ "$RUN_SMOKE" == "true" ]]; then
  echo "==> Smoke parity (GET routes)"
  RUST_BASE="http://127.0.0.1:${RUST_PORT}" \
  NEST_BASE="http://127.0.0.1:${NEST_PORT}" \
    bash "$ROOT/scripts/smoke-parity.sh" || {
      echo "Smoke parity reported mismatches — review before LiteSpeed cutover."
      exit 1
    }
fi

cat <<EOF

Dual-run backends are up:
  NestJS  http://127.0.0.1:${NEST_PORT}
  Rust    http://127.0.0.1:${RUST_PORT}

Next — LiteSpeed Phase 1 (health → Rust):
  sudo bash api-rust/scripts/cutover-proxy-to-rust.sh phase1

Full runbook: api/docs/RUST_CUTOVER.md
EOF
