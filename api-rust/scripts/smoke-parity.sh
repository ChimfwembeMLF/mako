#!/usr/bin/env bash
# Compare HTTP status codes between the Rust and NestJS APIs for the same routes.
# Safe by default: only GET requests, no request bodies, no destructive verbs.
#
# Usage:
#   ./scripts/smoke-parity.sh
#   RUST_BASE=http://127.0.0.1:4000 NEST_BASE=http://127.0.0.1:3000 ./scripts/smoke-parity.sh
#   RUST_BASE=http://127.0.0.1:4006 NEST_BASE=http://127.0.0.1:4005 ./scripts/smoke-parity.sh  # production dual-run
#   RUST_BASE=https://mako.tekreminnovations.com NEST_BASE=http://127.0.0.1:4005 ./scripts/smoke-parity.sh  # after cutover
#   SMOKE_TOKEN="<jwt>" ./scripts/smoke-parity.sh   # also compare authenticated GETs
#
# Exit 0 when all compared routes match; exit 1 on mismatches or unreachable servers.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ROUTES_FILE="${ROUTES_FILE:-$ROOT/src/openapi/routes.json}"
RUST_BASE="${RUST_BASE:-http://127.0.0.1:4000}"
NEST_BASE="${NEST_BASE:-http://127.0.0.1:3000}"
SMOKE_TOKEN="${SMOKE_TOKEN:-}"
PLACEHOLDER_ID="${PLACEHOLDER_ID:-00000000-0000-0000-0000-000000000001}"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required (brew install jq)" >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required" >&2
  exit 1
fi

passed=0
failed=0
skipped=0

normalize_path() {
  local path="$1"
  path="${path//\{id\}/$PLACEHOLDER_ID}"
  path="${path//\{tenant_id\}/$PLACEHOLDER_ID}"
  path="${path//\{deposit_id\}/smoke-deposit}"
  path="${path//\{queue\}/content-publish}"
  path="${path//\{job_id\}/smoke-job}"
  path="${path//\{report_id\}/content-performance}"
  path="${path//\{platform\}/facebook}"
  echo "$path"
}

fetch_status() {
  local base="$1"
  local method="$2"
  local path="$3"
  local url="${base%/}${path}"
  local args=(-s -o /dev/null -w "%{http_code}" -X "$method" --max-time 15)

  if [[ -n "$SMOKE_TOKEN" ]]; then
    args+=(-H "Authorization: Bearer $SMOKE_TOKEN")
  fi

  curl "${args[@]}" "$url" 2>/dev/null || echo "000"
}

compare_route() {
  local method="$1"
  local path="$2"
  local norm
  norm="$(normalize_path "$path")"

  local rust_status nest_status
  rust_status="$(fetch_status "$RUST_BASE" "$method" "$norm")"
  nest_status="$(fetch_status "$NEST_BASE" "$method" "$norm")"

  if [[ "$rust_status" == "000" || "$nest_status" == "000" ]]; then
    echo "SKIP  $method $norm (server unreachable: rust=$rust_status nest=$nest_status)"
    skipped=$((skipped + 1))
    return
  fi

  if [[ "$rust_status" == "$nest_status" ]]; then
    echo "OK    $method $norm -> $rust_status"
    passed=$((passed + 1))
  else
    echo "FAIL  $method $norm -> rust=$rust_status nest=$nest_status"
    failed=$((failed + 1))
  fi
}

echo "== Smoke parity: Rust ($RUST_BASE) vs NestJS ($NEST_BASE) =="
echo "Routes file: $ROUTES_FILE"
echo

echo "-- Core probes --"
compare_route GET "/api/v1/health"
compare_route GET "/documentation"
compare_route GET "/api-docs/openapi.json"
echo

echo "-- OpenAPI GET routes (safe, read-only) --"
while IFS=$'\t' read -r method path; do
  [[ "$method" == "GET" ]] || continue
  [[ "$path" == "/" ]] && continue
  compare_route "$method" "$path"
done < <(jq -r '.[] | "\(.method)\t\(.path)"' "$ROUTES_FILE")

echo
echo "Summary: passed=$passed failed=$failed skipped=$skipped"
if [[ "$failed" -gt 0 ]]; then
  exit 1
fi
