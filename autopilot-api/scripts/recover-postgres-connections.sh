#!/usr/bin/env bash
# Free Postgres connections after PM2 crash loops ("too many clients already").
# Run on the server as root:
#   bash scripts/recover-postgres-connections.sh
set -euo pipefail

echo "==> Stopping PM2 app"
npx pm2 stop "Mako API Production" 2>/dev/null || true

echo "==> Killing orphan node processes"
pkill -f "autopilot-api/dist/main" 2>/dev/null || true
sleep 2

if pgrep -f "autopilot-api/dist/main" >/dev/null; then
  echo "WARN: node processes still running:"
  pgrep -af "autopilot-api/dist/main" || true
  echo "Kill them manually: kill -9 <pid>"
fi

echo "==> Postgres connection summary"
sudo -u postgres psql -c "SELECT count(*) AS total, usename, state FROM pg_stat_activity GROUP BY usename, state ORDER BY total DESC;"

echo "==> Terminating mako DB sessions"
sudo -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = 'mako' AND pid <> pg_backend_pid();"

echo "==> After cleanup"
sudo -u postgres psql -c "SELECT count(*) AS mako_connections FROM pg_stat_activity WHERE usename = 'mako';"
sudo -u postgres psql -c "SHOW max_connections;"

echo ""
echo "Done. Start the app once:"
echo "  npx pm2 startOrRestart ecosystem.config.json --env production --update-env"
echo "  sleep 8 && curl -s http://127.0.0.1:4005/api/v1/health"
