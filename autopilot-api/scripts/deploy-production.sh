#!/usr/bin/env bash
# Full production deploy: install deps, build client + API, restart PM2.
# API: yarn | Client: npm (prod VPS)
# Run from autopilot-api/ or repo root (yarn deploy:prod):
#   bash scripts/deploy-production.sh --with-migrations
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLIENT="$ROOT/resources/client"
WITH_MIGRATIONS=false

for arg in "$@"; do
  case "$arg" in
    --with-migrations) WITH_MIGRATIONS=true ;;
  esac
done

cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing .env in $ROOT — copy docs/env.mako.production.server.template and fill secrets."
  exit 1
fi

echo "==> Installing API dependencies (yarn)"
yarn install --ignore-engines --frozen-lockfile 2>/dev/null || yarn install --ignore-engines

if [[ -f "$CLIENT/package.json" ]]; then
  echo "==> Installing client dependencies (npm)"
  bash scripts/install-client.sh
else
  echo "WARN: resources/client not found — build:client will fail unless client/dist already exists"
fi

echo "==> Building client (npm) + API (yarn)"
bash scripts/build-client.sh
yarn build

if [[ "$WITH_MIGRATIONS" == true ]]; then
  echo "==> Running production migrations"
  yarn migrations:run:prod
fi

mkdir -p logs
mkdir -p /var/log/pm2 2>/dev/null || sudo mkdir -p /var/log/pm2 2>/dev/null || true

echo "==> Stopping PM2 before restart"
npx pm2 stop "Mako API Production" 2>/dev/null || true
sleep 2

echo "==> Restarting PM2 (Mako API Production)"
npx pm2 startOrRestart ecosystem.config.json --env production --update-env

echo ""
echo "==> Health check"
sleep 2
curl -sf "http://127.0.0.1:${PORT:-4005}/api/v1/health" | head -c 500 || echo "(curl failed — check pm2 logs)"
echo ""
echo "Done. pm2 logs: yarn pm2:logs"
