#!/usr/bin/env bash
# Production deploy: install deps, build client + API, restart PM2.
# Nest serves React from client/dist — one command, no manual copy steps.
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

echo "==> Installing dependencies"
yarn install --ignore-engines --frozen-lockfile 2>/dev/null || yarn install --ignore-engines
if [[ -f "$CLIENT/package.json" ]]; then
  (cd "$CLIENT" && npm ci --ignore-scripts 2>/dev/null || npm install --ignore-scripts)
fi

echo "==> Building client + API (output: client/dist + dist/)"
yarn build

if [[ "$WITH_MIGRATIONS" == true ]]; then
  echo "==> Running production migrations"
  yarn migrations:run:prod
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
if curl -sf "http://127.0.0.1:${PORT}/" | head -1 | grep -qi doctype; then
  echo "SPA: OK (index.html served at /)"
else
  echo "WARN: / did not return HTML — check SERVE_CLIENT=true and client/dist"
fi
echo ""
echo "Done. pm2 logs: yarn pm2:logs"
