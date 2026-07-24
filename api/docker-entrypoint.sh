#!/bin/sh
set -e

cd /app/api 2>/dev/null || true

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "==> Running database migrations (NODE_ENV=${NODE_ENV:-production})..."
  yarn migrations:run:prod
else
  echo "==> Skipping migrations (RUN_MIGRATIONS=${RUN_MIGRATIONS:-false})"
fi

echo "==> Starting Nest API on PORT=${PORT:-4000} (SERVE_CLIENT=${SERVE_CLIENT:-false})..."
exec yarn start:prod
