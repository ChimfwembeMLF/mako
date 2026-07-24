#!/usr/bin/env bash
# Production deploy: install deps, build API (and optionally client for the separate SPA host).
# Nest is API-only — it does not serve client/dist.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/.." && pwd)"
CLIENT="$REPO_ROOT/client"
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

echo "==> Installing dependencies"
(cd "$REPO_ROOT" && corepack yarn install --immutable 2>/dev/null || corepack yarn install)

echo "==> Building client + API (output: client/dist + dist/)"
corepack yarn build

if [[ "$WITH_MIGRATIONS" == true ]]; then
  echo "==> Running production migrations"
  corepack yarn migrations:run:prod
fi

mkdir -p logs
mkdir -p /var/log/pm2 2>/dev/null || sudo mkdir -p /var/log/pm2 2>/dev/null || true

echo "==> OAuth / URL check"
NODE_ENV=production node scripts/check-oauth-env.js

echo "==> Restarting PM2"
npx pm2 stop "Mako API Production" 2>/dev/null || true
sleep 2
npx pm2 startOrRestart ecosystem.config.json --env production --update-env

echo ""
echo "==> Health check"
sleep 2
PORT="${PORT:-4005}"
curl -sf "http://127.0.0.1:${PORT}/api/v1/health" | head -c 500 || echo "(health curl failed — check pm2 logs)"
echo ""
if curl -sf "http://127.0.0.1:${PORT}/" 2>/dev/null | head -1 | grep -qi doctype; then
  echo "WARN: Nest is serving HTML at / — SPA should be the client container, not Nest (SERVE_CLIENT must stay false)"
else
  echo "API-only: OK (Nest is not hosting client/dist)"
fi
echo ""
echo "Done. pm2 logs: yarn pm2:logs"
