# Dokploy environment variables (Mako)

Use the **Environment** tab on your Compose app (`mako-prod-nyieyw`) — not a commented `.env` file from the repo.

Docs: [Dokploy Docker Compose](https://docs.dokploy.com/docs/core/docker-compose) · [Environment variables](https://docs.dokploy.com/docs/core/variables)

## Quick setup

1. Open **Dokploy → Compose → mako-prod-nyieyw → Environment** (shortcut: `g` then `e`).
2. **Delete all** existing content in the editor.
3. On your laptop (where `api/.env.production` lives):

   ```bash
   ./scripts/export-dokploy-env.sh > /tmp/dokploy.env
   ```

4. Open `/tmp/dokploy.env` — copy **everything** — paste into Dokploy Environment.
5. Click **Save**, then **Deploy**.

`docker-compose.yml` builds the **NestJS** API (`api/Dockerfile`) and loads Environment via `env_file: .env`. See [DOKPLOY_RUST.md](./DOKPLOY_RUST.md) if you temporarily switch back to Rust.

## Rules (avoids `key cannot contain a space`)

| Do | Don't |
|----|--------|
| `KEY=value` one per line | Lines starting with `#` |
| Quote spaces in bulk paste: `APP_NAME="Tekrem Innovation Solutions - Mako"` | `APP_NAME=Tekrem Innovation Solutions - Mako` |
| Only `JWT_SECRET` for auth | Multi-line `JWT_PRIVATE_KEY` / PEM blocks |
| Empty value: `META_AD_ACCOUNT_ID=` | Section headers like `# Redis - Session Store` |

## Values with spaces

**Bulk editor** (paste from export script): keep quotes from `api/.env.production`:

```env
APP_NAME="Tekrem Innovation Solutions - Mako"
COMPANY_ADDRESS="Plot No. 03/84 off Esther Lungu Road, Lusaka Zambia."
```

**Add Variable** UI (separate Key / Value fields): enter the value **without** quotes, e.g. `Tekrem Innovation Solutions - Mako`.

## Checklist of keys

See `deploy/dokploy.env.example` in the repo for every variable name and production URLs (secrets shown as `CHANGE_ME`).

Fill real secrets in Dokploy from your local `api/.env.production` — that file is gitignored and never deployed via git pull.

## After changing env

Always **Redeploy** the compose stack. Env changes are not picked up until rebuild/restart.

## Verify

```bash
# On server after deploy
docker logs mako-prod-nyieyw-api-1 --tail 200
docker exec -it mako-prod-nyieyw-api-1 printenv | grep -E 'NODE_ENV|PORT|DB_HOST|SERVE_CLIENT|SESSION_SECRET|FRONTEND_URL'
curl -s https://mako.tekreminnovations.com/api/v1/health

# One-off TypeORM migrations (Nest API skips them on boot by default)
docker compose --profile migrate run --rm migrate
```

If `api` is **unhealthy**: Nest never reached `/api/v1/health` in time, or exited on boot.
Common causes: missing `SESSION_SECRET` / `FRONTEND_URL`, Redis host unreachable, DB host wrong, or migrations enabled and hanging (`RUN_MIGRATIONS` should be `false` unless you intentionally run them via the migrate profile).

## Optional: Dokploy shared variables

For secrets reused across services, define project-level variables in Dokploy and reference them in Environment as `${{project.VAR_NAME}}` per [Dokploy variables docs](https://docs.dokploy.com/docs/core/variables). Mako only needs the Compose service Environment for the API container.
