# Dual-run: NestJS + Rust API

Run both APIs against the same PostgreSQL database during cutover.

| Service | PM2 name | Default port | Role |
|---------|----------|--------------|------|
| NestJS | `Mako API Production` | `4005` | Primary + SPA |
| Rust | `Mako API Rust` | `4006` | Parity candidate |

**Production proxy:** LiteSpeed/CyberPanel on `mako.tekreminnovations.com` (not nginx).  
Full runbook: [`api/docs/RUST_CUTOVER.md`](../api/docs/RUST_CUTOVER.md).

## Start both (on server)

```bash
cd "$DEPLOY_PATH"
bash api-rust/scripts/dual-run-start.sh
```

Or step by step:

```bash
# NestJS (existing)
cd api && yarn deploy:prod

# Rust (release build + PM2)
cd api-rust && ./scripts/deploy-production.sh
```

## LiteSpeed reverse proxy (gradual cutover)

Snippets live in `deploy/litespeed/`. Apply on the **mako.tekreminnovations.com** vhost (`vhconf.conf`).

### Phase 1 — health only → Rust

Add **above** the existing `context /api` block:

```apache
context /api/v1/health {
  type                    proxy
  handler                 127.0.0.1:4006
  addDefaultCharset       off
}
```

Or: `sudo bash api-rust/scripts/cutover-proxy-to-rust.sh phase1`

### Phase 2 — full `/api` → Rust

Change `context /api` handler from `127.0.0.1:4005` to `127.0.0.1:4006`.

Or: `sudo bash api-rust/scripts/cutover-proxy-to-rust.sh phase2`

### Rollback

`sudo bash api-rust/scripts/cutover-proxy-to-rust.sh rollback`

Restart after any vhost edit:

```bash
sudo systemctl restart lsws
```

Optional named backends: `deploy/litespeed/extprocessor-dual-run.snippet`.

## Nginx (local / docker only)

See `deploy/nginx/dual-run.conf` if you are not on LiteSpeed.

## Smoke parity

```bash
cd api-rust
RUST_BASE=http://127.0.0.1:4006 NEST_BASE=http://127.0.0.1:4005 ./scripts/smoke-parity.sh
```

After Phase 2, compare public URL vs direct Nest:

```bash
RUST_BASE=https://mako.tekreminnovations.com NEST_BASE=http://127.0.0.1:4005 ./scripts/smoke-parity.sh
```

## Full migration (recommended)

```bash
cd "$DEPLOY_PATH"
sudo bash api-rust/scripts/migrate-everything.sh
bash api-rust/scripts/retire-nest-api.sh   # when stable
```

Or step by step: Phase 1 → Phase 2 → Phase 3 (`cutover-proxy-to-rust.sh full`).

## Retire NestJS

When smoke parity is clean and production metrics look good:

1. Point LiteSpeed `context /api` fully to `:4006` (Phase 2)
2. Disable Nest crons / queues to avoid double work
3. `pm2 stop "Mako API Production"`
4. Deploy via `deploy-api-rust.yml` only

See [`api/docs/RUST_CUTOVER.md`](../api/docs/RUST_CUTOVER.md) for the full checklist.
