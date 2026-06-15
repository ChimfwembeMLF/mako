#!/usr/bin/env bash
# Install React client deps with npm (VPS prod — yarn often unavailable/broken for client).
set -euo pipefail
CLIENT="$(cd "$(dirname "$0")/../resources/client" && pwd)"
cd "$CLIENT"
if [[ -f package-lock.json ]]; then
  npm ci --ignore-scripts 2>/dev/null || npm install --ignore-scripts
else
  npm install --ignore-scripts
fi
