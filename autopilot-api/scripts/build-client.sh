#!/usr/bin/env bash
# Build React client with npm → autopilot-api/client/dist
set -euo pipefail
CLIENT="$(cd "$(dirname "$0")/../resources/client" && pwd)"
cd "$CLIENT"
npm run build:prod
