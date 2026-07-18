#!/usr/bin/env bash
# Production PM2 setup — run from autopilot-api/ on the server.
set -euo pipefail

cd "$(dirname "$0")/.."
REPO_ROOT="$(cd .. && pwd)"

if [[ ! -f .env ]]; then
  if [[ -f docs/env.mako.production.server.template ]]; then
    echo "Creating .env from docs/env.mako.production.server.template — edit secrets before going live."
    cp docs/env.mako.production.server.template .env
  elif [[ -f docs/env.mako.production.template ]]; then
    echo "Creating .env from docs/env.mako.production.template — edit secrets before going live."
    cp docs/env.mako.production.template .env
  else
    echo "Create .env in $(pwd) before starting (see docs/env.production.template)"
    exit 1
  fi
fi

mkdir -p logs /var/log/pm2 2>/dev/null || sudo mkdir -p /var/log/pm2

if [[ -f ../client/package.json ]]; then
  echo "==> Full deploy (install + build client + API + PM2)"
  bash scripts/deploy-production.sh --with-migrations
else
  echo "==> Client not found — API-only build"
  yarn install
  yarn build
  yarn migrations:run:prod
  yarn pm2:start
fi

yarn pm2:save

echo ""
echo "Mako API Production is running on port \${PORT:-4005}"
echo "  yarn pm2:status"
echo "  yarn pm2:logs"
echo ""
echo "Enable restart on server reboot:"
echo "  yarn pm2:startup"
echo "  (run the sudo command it prints, then: yarn pm2:save)"
