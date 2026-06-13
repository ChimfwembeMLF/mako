#!/usr/bin/env bash
# Production PM2 setup — run from autopilot-api/ on the server.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  if [[ -f docs/env.mako.production.template ]]; then
    echo "Creating .env from docs/env.mako.production.template — edit secrets before going live."
    cp docs/env.mako.production.template .env
  else
    echo "Create .env in $(pwd) before starting (see docs/env.production.template)"
    exit 1
  fi
fi

mkdir -p logs
npm run build
npm run migrations:run
npm run pm2:start
npm run pm2:save

echo ""
echo "autopilot-api is running on port \${PORT:-5000} (PM2 name: autopilot-api)"
echo "  npm run pm2:status"
echo "  npm run pm2:logs"
echo ""
echo "Enable restart on server reboot:"
echo "  npm run pm2:startup"
echo "  (run the sudo command it prints, then: npm run pm2:save)"
