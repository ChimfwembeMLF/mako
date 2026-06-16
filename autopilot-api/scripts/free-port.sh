#!/usr/bin/env bash
# Free a TCP port before dev (nest --watch often leaves orphans after Ctrl+C).
set -euo pipefail

PORT="${1:-4000}"

if ! command -v lsof >/dev/null 2>&1; then
  exit 0
fi

PIDS="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
if [[ -z "$PIDS" ]]; then
  exit 0
fi

echo "==> Freeing port $PORT (PIDs: $(echo "$PIDS" | tr '\n' ' '))"
kill $PIDS 2>/dev/null || true
sleep 1
STILL="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
if [[ -n "$STILL" ]]; then
  kill -9 $STILL 2>/dev/null || true
fi
