# Rust API production cutover runbook

Dual-run **NestJS** (`:4005`) and **Rust** (`:4006`) on the same PostgreSQL database, then shift LiteSpeed proxy traffic gradually.

| Step | Public traffic | Nest PM2 | Rust PM2 |
|------|----------------|----------|----------|
| 0 — baseline | `/api` → Nest | running | — |
| 1 — dual-run | `/api` → Nest; optional health → Rust | running | running |
| 2 — cutover | `/api` → Rust | running (fallback) | running |
| 3 — retire | `/api` → Rust | stopped | running |

Reference: [`api-rust/docs/DUAL_RUN.md`](../api-rust/docs/DUAL_RUN.md), [`SAME_ORIGIN_PROXY.md`](./SAME_ORIGIN_PROXY.md).

---

## 0. Prerequisites

On the production server (`DEPLOY_PATH` from GitHub secrets):

```bash
cd "$DEPLOY_PATH"
git pull origin main

# NestJS must already be healthy
curl -s http://127.0.0.1:4005/api/v1/health
pm2 status
```

Shared `.env`: Rust reads `api/.env` (symlinked by deploy script). Ensure queue/cron flags match your cutover plan:

```env
QUEUES_ENABLED=true
REDIS_HOST=127.0.0.1   # or REDIS_URL
THROTTLE_ENABLED=true
```

---

## 1. Start dual-run backends

```bash
cd "$DEPLOY_PATH"
bash api-rust/scripts/dual-run-start.sh
```

This builds Rust, starts PM2 `Mako API Rust` on `:4006`, checks Nest on `:4005`, and runs smoke parity.

Manual smoke (optional, with JWT for auth routes):

```bash
cd api-rust
RUST_BASE=http://127.0.0.1:4006 NEST_BASE=http://127.0.0.1:4005 ./scripts/smoke-parity.sh
SMOKE_TOKEN="<jwt>" RUST_BASE=http://127.0.0.1:4006 NEST_BASE=http://127.0.0.1:4005 ./scripts/smoke-parity.sh
```

Public URL smoke (after proxy change):

```bash
RUST_BASE=https://mako.tekreminnovations.com NEST_BASE=http://127.0.0.1:4005 ./scripts/smoke-parity.sh
```

---

## 2. LiteSpeed Phase 1 — health → Rust

Route only `GET /api/v1/health` to Rust so production traffic stays on Nest while you validate the new process.

**CyberPanel:** Websites → **mako.tekreminnovations.com** → **vHost Conf**

Snippet: [`api-rust/deploy/litespeed/phase1-health-to-rust.snippet`](../api-rust/deploy/litespeed/phase1-health-to-rust.snippet)

Or run the helper (on server, as root):

```bash
sudo bash api-rust/scripts/cutover-proxy-to-rust.sh phase1
```

Verify:

```bash
curl -s https://mako.tekreminnovations.com/api/v1/health
pm2 logs "Mako API Rust" --lines 20
```

---

## 3. LiteSpeed Phase 2 — full `/api` → Rust

When smoke parity is clean and you have a rollback plan:

```bash
sudo bash api-rust/scripts/cutover-proxy-to-rust.sh phase2
```

Snippet reference: [`api-rust/deploy/litespeed/phase2-api-cutover.snippet`](../api-rust/deploy/litespeed/phase2-api-cutover.snippet)

**Rust now serves** `/uploads`, `/documentation`, and legal pages — use Phase 3 / `full` cutover for all proxy contexts.

Monitor for 24–48h:

```bash
pm2 logs "Mako API Rust" --lines 50
pm2 logs "Mako API Production" --lines 20
RUST_BASE=http://127.0.0.1:4006 NEST_BASE=http://127.0.0.1:4005 api-rust/scripts/smoke-parity.sh
```

---

## 4. LiteSpeed Phase 3 — full cutover (all API contexts)

```bash
sudo bash api-rust/scripts/cutover-proxy-to-rust.sh full
```

Moves `/api`, `/uploads`, `/documentation`, and `/admin` to Rust (`:4006`).  
Snippet: [`api-rust/deploy/litespeed/phase3-full-cutover.snippet`](../api-rust/deploy/litespeed/phase3-full-cutover.snippet)

---

## 5. Full migration (one command)

When backends are healthy on the server:

```bash
cd "$DEPLOY_PATH"
sudo bash api-rust/scripts/migrate-everything.sh
```

Steps performed automatically:
1. `dual-run-start.sh` — build Rust, PM2 restart, smoke parity vs Nest
2. `cutover-proxy-to-rust.sh full` — all API proxy contexts → `:4006`
3. Public health check on `https://mako.tekreminnovations.com/api/v1/health`

Retire Nest when metrics look good:

```bash
bash api-rust/scripts/retire-nest-api.sh
# or inline: RETIRE_NEST=true sudo bash api-rust/scripts/migrate-everything.sh
```

---

## 6. Rollback

```bash
sudo bash api-rust/scripts/cutover-proxy-to-rust.sh rollback
```

Nest immediately receives API traffic again. Rust can keep running for debugging.

---

## 7. Retire NestJS API

Only after stable production on Rust:

```bash
pm2 stop "Mako API Production"
# Optional: pm2 delete "Mako API Production"
```

Update CI so only `deploy-api-rust.yml` deploys the API. Keep Nest deploy workflow disabled or limited to legacy needs.

Disable duplicate crons: with `QUEUES_ENABLED=true` on Rust, ensure Nest crons are off (`*_CRON_ENABLED=false` in Nest env) to avoid double-processing.

---

## GitHub Actions deploy

- **Rust:** `.github/workflows/deploy-api-rust.yml` — pushes to `main` under `api-rust/**`
- **Smoke on deploy:** workflow_dispatch with **Run smoke parity** checked

---

## Optional: extprocessor backends

For cleaner handler swaps, add named backends once:

[`api-rust/deploy/litespeed/extprocessor-dual-run.snippet`](../api-rust/deploy/litespeed/extprocessor-dual-run.snippet)

Then set `handler mako_api_rust` or `handler mako_api_nest` in each context.

---

## Nginx (non-production)

Docker/local nginx reference: [`api-rust/deploy/nginx/dual-run.conf`](../api-rust/deploy/nginx/dual-run.conf)
