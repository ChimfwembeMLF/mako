# Dokploy → Rust API

Dokploy Compose now builds **`api-rust`** (Axum) instead of NestJS for the `api` service. The SPA (`client`) is unchanged and proxies `/api` to `api:4000`.

## What changed

| Service | Before | After |
|---------|--------|-------|
| `api` | Nest (`api/Dockerfile`) | Rust (`api-rust/Dockerfile`) |
| `client` | Vite → nginx | Same |
| Crons / queues | Nest Schedule + BullMQ | Rust in-process crons + Redis `JobStore` |
| Migrations | Nest entrypoint | **Manual** Nest one-off (`migrate` profile) |

## Dokploy steps

1. **Push** this commit (compose + Dockerfiles).
2. **Environment** tab — keep your existing env. Ensure at least:

```env
QUEUES_ENABLED=true
REDIS_HOST=mako-redis-zqnrkp
REDIS_PORT=6379
REDIS_PASSWORD=<your-redis-password>
AUTO_PUBLISH_CRON_ENABLED=true
COMMENT_SYNC_CRON_ENABLED=true
DAILY_WORKFLOW_CRON_ENABLED=true
NOTIFICATION_CRON_ENABLED=true
PORT=4000
NODE_ENV=production
```

Optional (defaults true in Rust):

```env
PAWAPAY_POLL_CRON_ENABLED=true
SUBSCRIPTION_RENEWAL_CRON_ENABLED=true
INSIGHTS_SYNC_CRON_ENABLED=true
WEEKLY_DIGEST_CRON_ENABLED=true
```

3. **Redeploy** the Compose app. First Rust build can take **10–20+ minutes** (cargo release).
4. Confirm health returns Rust:

```bash
curl -s https://mako.tekreminnovations.com/api/v1/health
# expect: "service":"Mako API (Rust)", "apiMode":"rust-port"
```

## Migrations (still Nest / TypeORM)

Rust does **not** run TypeORM migrations. After schema changes:

```bash
# On the Dokploy host, in the compose project directory:
docker compose --profile migrate run --rm migrate
```

Or run `yarn migrations:run` from a Nest checkout against the same DB.

## Do not double-run Nest + Rust

If Nest is still running elsewhere (PM2 / old container) with crons/queues on:

- Stop Nest, **or**
- Set Nest `QUEUES_ENABLED=false` and all `*_CRON_ENABLED=false`

Only **one** process should own crons and queues.

## Rollback to Nest

In `docker-compose.yml`, point `api.build` back to:

```yaml
build:
  context: .
  dockerfile: api/Dockerfile
```

Redeploy. Prefer disabling Rust crons first if both would overlap.

## Related docs

- [RUST_CUTOVER.md](../api/docs/RUST_CUTOVER.md) — LiteSpeed / PM2 cutover
- [RUST_MIGRATION.md](../api/docs/RUST_MIGRATION.md) — parity checklist
- [DOKPLOY_ENV.md](./DOKPLOY_ENV.md) — Environment tab rules
