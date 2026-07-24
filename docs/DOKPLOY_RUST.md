# Dokploy → Rust API

Dokploy Compose currently builds **NestJS** (`api/Dockerfile`) for the `api` service by default. This doc covers the optional Rust cutover. The SPA (`client`) is unchanged and proxies `/api` to `api:4000`.

## Optional: switch `api` to Rust

| Service | Nest (current default) | Rust cutover |
|---------|------------------------|--------------|
| `api` | Nest (`api/Dockerfile`, context `.`) | Rust (`api-rust/Dockerfile`, context `./api-rust`) |
| `client` | Vite → nginx | Same |
| Crons / queues | Nest Schedule + BullMQ | Rust in-process crons + Redis `JobStore` |
| Migrations | Nest entrypoint (`RUN_MIGRATIONS`) | Nest one-off (`migrate` profile) |

## Dokploy steps (Rust cutover)

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

## Switch back to Nest (default)

In `docker-compose.yml`, point `api.build` to:

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
