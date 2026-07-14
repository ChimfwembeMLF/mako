#!/usr/bin/env bash
# Production deploy: build release binary, restart PM2 (dual-run alongside NestJS).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env && -f ../api/.env ]]; then
  echo "==> Linking ../api/.env"
  ln -sf ../api/.env .env
fi

if [[ ! -f .env ]]; then
  echo "Missing .env — copy api/.env or api/docs/env.mako.production.server.template"
  exit 1
fi

echo "==> Building release binary"
cargo build --release

mkdir -p logs

echo "==> Restarting PM2 (Mako API Rust)"
if command -v pm2 >/dev/null 2>&1; then
  npx pm2 startOrRestart ecosystem.config.json --only "Mako API Rust" --env production --update-env
else
  echo "pm2 not found — start manually: PORT=4006 ./target/release/api-rust"
  exit 1
fi

PORT="${RUST_PORT:-4006}"
echo "==> Health check (port $PORT)"
sleep 2
curl -sf "http://127.0.0.1:${PORT}/api/v1/health" | head -c 500 || {
  echo "Health check failed — see pm2 logs"
  exit 1
}
echo ""
echo "Done. Rust API on :${PORT} — pm2 logs Mako\\ API\\ Rust"
