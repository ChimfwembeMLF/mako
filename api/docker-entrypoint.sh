#!/bin/sh
set -e

if [ "${RUN_MIGRATIONS:-true}" != "false" ]; then
  echo "==> Running database migrations (NODE_ENV=${NODE_ENV:-production})..."
  yarn migrations:run:prod
else
  echo "==> Skipping migrations (RUN_MIGRATIONS=false)"
fi

echo "==> Starting API..."
exec yarn start:prod
