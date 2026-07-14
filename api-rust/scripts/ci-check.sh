#!/usr/bin/env bash
# Local CI checks — mirrors .github/workflows/api-rust-ci.yml
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> cargo fmt --check"
cargo fmt --check

echo "==> cargo test"
cargo test

echo "==> cargo build --release"
cargo build --release

echo "==> validate routes.json"
jq empty src/openapi/routes.json

echo "==> validate smoke-parity.sh"
bash -n scripts/smoke-parity.sh

if command -v cargo-clippy >/dev/null 2>&1 || cargo clippy -V >/dev/null 2>&1; then
  echo "==> cargo clippy (advisory)"
  cargo clippy --all-targets -- -D warnings || echo "clippy reported issues (advisory)"
fi

echo "All api-rust CI checks passed."
