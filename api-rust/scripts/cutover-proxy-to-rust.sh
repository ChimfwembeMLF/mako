#!/usr/bin/env bash
# Apply LiteSpeed proxy cutover on the production server (SSH into host first).
#
# Usage:
#   sudo bash api-rust/scripts/cutover-proxy-to-rust.sh phase1   # health → :4006
#   sudo bash api-rust/scripts/cutover-proxy-to-rust.sh phase2   # /api → :4006
#   sudo bash api-rust/scripts/cutover-proxy-to-rust.sh full     # all API contexts → :4006
#   sudo bash api-rust/scripts/cutover-proxy-to-rust.sh rollback # revert to :4005
#
# Env:
#   LITESPEED_VHOST_CONF  default: /usr/local/lsws/conf/vhosts/mako.tekreminnovations.com/vhconf.conf

set -euo pipefail

PHASE="${1:-}"
VHOST="${LITESPEED_VHOST_CONF:-/usr/local/lsws/conf/vhosts/mako.tekreminnovations.com/vhconf.conf}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

usage() {
  echo "Usage: $0 {phase1|phase2|full|rollback}" >&2
  exit 1
}

[[ -n "$PHASE" ]] || usage

if [[ ! -f "$VHOST" ]]; then
  echo "vhost not found: $VHOST" >&2
  echo "Set LITESPEED_VHOST_CONF to your CyberPanel vhost path." >&2
  exit 1
fi

backup="${VHOST}.bak.$(date +%Y%m%d%H%M%S)"
cp "$VHOST" "$backup"
echo "Backup: $backup"

apply_snippet() {
  local snippet="$1"
  if [[ ! -f "$snippet" ]]; then
    echo "Missing snippet: $snippet" >&2
    exit 1
  fi
  echo "Manual step: merge contents of $snippet into $VHOST"
  echo "---"
  cat "$snippet"
  echo "---"
}

case "$PHASE" in
  phase1)
    # Ensure health context points to Rust; leave broader /api on Nest if present.
    if grep -q 'context /api/v1/health' "$VHOST"; then
      sed -i.tmp 's|context /api/v1/health.*|context /api/v1/health|' "$VHOST" 2>/dev/null || true
      sed -i.tmp '/context \/api\/v1\/health/,/^}/ s|handler[[:space:]]*127\.0\.0\.1:4005|handler                 127.0.0.1:4006|' "$VHOST"
      rm -f "${VHOST}.tmp"
      echo "Updated existing context /api/v1/health → 127.0.0.1:4006"
    else
      echo "Appending Phase 1 health context..."
      {
        echo ""
        echo "# --- Rust dual-run Phase 1 (auto $(date -Iseconds)) ---"
        grep -v '^#' "$ROOT/deploy/litespeed/phase1-health-to-rust.snippet" | sed '/^$/d'
      } >> "$VHOST"
    fi
    ;;
  phase2)
    if grep -q 'context /api {' "$VHOST" || grep -q 'context /api$' "$VHOST"; then
      sed -i.tmp '/^context \/api/,/^}/ s|handler[[:space:]]*127\.0\.0\.1:4005|handler                 127.0.0.1:4006|' "$VHOST"
      sed -i.tmp '/^context \/api/,/^}/ s|handler[[:space:]]*mako_api_nest|handler                 mako_api_rust|' "$VHOST"
      rm -f "${VHOST}.tmp"
      echo "Updated context /api → 127.0.0.1:4006 (or mako_api_rust)"
    else
      apply_snippet "$ROOT/deploy/litespeed/phase2-api-cutover.snippet"
      exit 0
    fi
    # Remove redundant phase1 health block when full /api is on Rust
    if grep -q 'context /api/v1/health' "$VHOST"; then
      perl -i -0pe 's/\n# --- Rust dual-run Phase 1.*?\ncontext \/api\/v1\/health \{[^}]*\}\n?//s' "$VHOST" 2>/dev/null || \
        echo "Note: remove context /api/v1/health manually if still present (redundant)."
    fi
    ;;
  full)
    for ctx in "/api" "/uploads" "/documentation" "/admin"; do
      escaped="${ctx//\//\\/}"
      if grep -q "context ${ctx}" "$VHOST"; then
        sed -i.tmp "/^context ${escaped}/,/^}/ s|handler[[:space:]]*127\.0\.0\.1:4005|handler                 127.0.0.1:4006|" "$VHOST"
        sed -i.tmp "/^context ${escaped}/,/^}/ s|handler[[:space:]]*mako_api_nest|handler                 mako_api_rust|" "$VHOST"
        echo "Updated context ${ctx} → 127.0.0.1:4006"
      else
        echo "Warning: context ${ctx} not found — add manually from deploy/litespeed/phase3-full-cutover.snippet"
      fi
    done
    rm -f "${VHOST}.tmp"
    if grep -q 'context /api/v1/health' "$VHOST"; then
      perl -i -0pe 's/\n# --- Rust dual-run Phase 1.*?\ncontext \/api\/v1\/health \{[^}]*\}\n?//s' "$VHOST" 2>/dev/null || true
    fi
    ;;
  rollback)
    for ctx in "/api" "/uploads" "/documentation" "/admin" "/api/v1/health"; do
      escaped="${ctx//\//\\/}"
      sed -i.tmp "/^context ${escaped}/,/^}/ s|handler[[:space:]]*127\.0\.0\.1:4006|handler                 127.0.0.1:4005|" "$VHOST" 2>/dev/null || true
      sed -i.tmp "/^context ${escaped}/,/^}/ s|handler[[:space:]]*mako_api_rust|handler                 mako_api_nest|" "$VHOST" 2>/dev/null || true
    done
    rm -f "${VHOST}.tmp"
    echo "Rolled back API proxy contexts → Nest (:4005)"
    ;;
  *)
    usage
    ;;
esac

if command -v systemctl >/dev/null 2>&1; then
  echo "Restarting LiteSpeed..."
  systemctl restart lsws
elif [[ -x /usr/local/lsws/bin/lswsctrl ]]; then
  /usr/local/lsws/bin/lswsctrl restart
else
  echo "Restart LiteSpeed manually: systemctl restart lsws"
fi

echo "Verify:"
echo "  curl -s https://mako.tekreminnovations.com/api/v1/health"
echo "  pm2 status"
echo "  pm2 logs \"Mako API Rust\" --lines 30"
