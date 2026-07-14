#!/usr/bin/env bash
# Stop NestJS API after Rust cutover. Keeps PM2 process list saved.
set -euo pipefail

echo "==> Stopping NestJS API (Mako API Production)"
if command -v pm2 >/dev/null 2>&1; then
  pm2 stop "Mako API Production" || true
  pm2 save
  pm2 status
else
  echo "pm2 not found"
  exit 1
fi

cat <<'EOF'

NestJS API stopped. Rust is now the sole API backend.

Recommended api/.env updates if you ever restart Nest (avoid double crons/queues):
  QUEUES_ENABLED=false
  AUTO_PUBLISH_CRON_ENABLED=false
  COMMENT_SYNC_CRON_ENABLED=false
  PAWAPAY_POLL_CRON_ENABLED=false
  SUBSCRIPTION_RENEWAL_CRON_ENABLED=false
  DAILY_WORKFLOW_CRON_ENABLED=false
  INSIGHTS_SYNC_CRON_ENABLED=false
  NOTIFICATION_CRON_ENABLED=false
  WEEKLY_DIGEST_CRON_ENABLED=false

Deploy Rust only via .github/workflows/deploy-api-rust.yml
EOF
