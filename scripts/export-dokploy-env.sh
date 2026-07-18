#!/usr/bin/env bash
# Docker/Dokploy-safe .env (no comments, no blank lines).
#
# Dokploy: Compose app → Environment tab → paste this output (replace all) → Save → Deploy
# Local:   ./scripts/export-dokploy-env.sh > .env && docker compose up --build
#
# Source: api/.env.production (gitignored — edit secrets there, then export)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${1:-$ROOT/api/.env.production}"
if [[ ! -f "$SRC" ]]; then
  echo "Missing $SRC" >&2
  exit 1
fi
grep -v '^#' "$SRC" | grep -v '^[[:space:]]*$'
