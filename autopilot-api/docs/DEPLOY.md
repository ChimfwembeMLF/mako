# Production deployment guide — Tekrem Innovation Solutions - Mako

## 1. Database

**Development** (schema auto-updates):
```env
DB_SYNCHRONIZE=true
```

**Production** (recommended):
```env
DB_SYNCHRONIZE=false
NODE_ENV=production
```

**First-time production database** — migrations alone are not enough (they only patch an existing schema; dev relies on `DB_SYNCHRONIZE=true` for base tables):

```bash
cd autopilot-api
# Set DB_* in .env, then:
npm run db:sync          # creates core tables from entities (content_items, users, …)
npm run migrations:run   # applies incremental patches
npm run migrations:show  # optional — list applied migrations
```

If crons log `relation "content_items" does not exist`, run `npm run db:sync` then restart the API.

---

## 2. API environment (required)

Copy `docs/env.mako.production.template` (or `docs/env.production.template`) to `.env` on your server and fill in values.

Build & start with PM2 (production):
```bash
cd autopilot-api
cp docs/env.mako.production.server.template .env   # then edit secrets
yarn install:all
yarn build:all
yarn db:sync
yarn migrations:run:prod
# After first owner signs up (or if tenant already exists):
yarn seed:prod
yarn pm2:start

# Or from repo root:
yarn install:all && yarn deploy:prod
```

```bash
# After code updates
npm run deploy:prod

npm run pm2:status
npm run pm2:logs
npm run pm2:save
npm run pm2:startup   # run the sudo command it prints
```

| Variable | Production value (Firebase + makoapi) |
|----------|-------------------------------------|
| `PORT` | `4005` (see `ecosystem.config.json`) |
| `NODE_ENV` | `production` |
| `DB_SYNCHRONIZE` | `false` |
| `JWT_SECRET` | Strong random string |
| `SESSION_SECRET` | Strong random string (required — app exits if missing) |
| `API_PUBLIC_URL` | `https://makoapi.tekreminnovations.com` |
| `FRONTEND_URL` | `https://YOUR_PROJECT.web.app` (Firebase Hosting URL) |
| `CORS_ORIGIN` | Same as `FRONTEND_URL` (comma-separate custom domains) |
| `MISTRAL_API_KEY` | Your Mistral key |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | Public media bucket (recommended) |
| `PAYMENTS_DEV_AUTO_COMPLETE` | `false` |
| `META_WEBHOOK_VERIFY_TOKEN` | Random string for Meta webhook verify |
| `COMMENT_SYNC_CRON_ENABLED` | `true` |

---

## 2b. PM2 scripts (`package.json`)

| Script | Purpose |
|--------|---------|
| `npm run pm2:start` | First production start |
| `npm run seed:prod` | Permissions, plans, theme, Mako widget key (no demo users) |
| `npm run deploy:prod` | Build + migrations + restart |
| `npm run deploy:pm2` | Build + restart (no migrate) |
| `npm run pm2:restart` | Restart running process |
| `npm run pm2:logs` | Tail logs |
| `npm run pm2:status` | Process status |
| `npm run pm2:save` | Save PM2 process list |
| `npm run pm2:startup` | Generate boot script |

Or one-shot setup: `bash scripts/pm2-setup.sh`

**Process file:** `ecosystem.config.json` (PM2 app name: `Mako API Production`, single instance, port `4005`).

```bash
sudo mkdir -p /var/log/pm2 && sudo chown "$USER" /var/log/pm2
npx pm2 start ecosystem.config.json --env production
npx pm2 startOrRestart ecosystem.config.json --env production --update-env
```

Logs: `/var/log/pm2/mako-api-output.log`, `/var/log/pm2/mako-api-error.log`

Secrets live in `.env` on the server — NestJS loads them at boot; PM2 does not parse `.env`.

---

## 3. Client — Firebase Hosting

See **`docs/FIREBASE_HOSTING.md`** for the full guide.

```env
# resources/client/.env.production
VITE_API_BASE_URL=https://makoapi.tekreminnovations.com
VITE_WIDGET_API_KEY=pk_live_...
```

```bash
cd autopilot-api/resources/client
yarn install
yarn firebase login
yarn firebase use --add
yarn deploy:firebase
```

| Host | Role |
|------|------|
| `YOUR_PROJECT.web.app` | Frontend (Firebase Hosting static SPA) |
| `makoapi.tekreminnovations.com` | API (NestJS on VPS) |

Local dev: leave `VITE_API_BASE_URL` empty in `.env` — Vite proxies `/api` to `localhost:4000`.

---

## 4. Meta App Review URLs

Register in [Meta Developers](https://developers.facebook.com) → App → Settings → Basic:

| Field | URL |
|-------|-----|
| **Privacy Policy** | `https://app.yourdomain.com/privacy` or `https://api.yourdomain.com/privacy.html` |
| **Terms** | `https://app.yourdomain.com/terms` |
| **Data Deletion Instructions** | `https://app.yourdomain.com/data-deletion` |
| **Data Deletion Callback** | `https://api.yourdomain.com/api/v1/webhooks/meta/data-deletion` |
| **Deauthorize Callback** | `https://api.yourdomain.com/api/v1/webhooks/meta/deauthorize` |

Webhook verify token: same as `META_WEBHOOK_VERIFY_TOKEN`.

### WhatsApp (clients do not use Meta Developer Console)

**You (operator) do steps 1–6 in Meta for Developers once.** Clients only click **Enable WhatsApp** in Publisher Connect.

1. Meta App → Add **WhatsApp** product → API Setup  
2. Copy **Phone number ID**, **WhatsApp Business Account ID**, and a **permanent access token** (System User in production)  
3. Set on the API server:

```env
WHATSAPP_PLATFORM_ENABLED=true
WHATSAPP_PLATFORM_PHONE_NUMBER_ID=...
WHATSAPP_PLATFORM_ACCESS_TOKEN=...
WHATSAPP_PLATFORM_WABA_ID=...
WHATSAPP_PLATFORM_DISPLAY_NAME=Your Brand
WHATSAPP_PLATFORM_DISPLAY_PHONE=+260...
META_WEBHOOK_VERIFY_TOKEN=...
WHATSAPP_BROADCAST_TEMPLATE=hello_world
```

4. Meta App → WhatsApp → Configuration → Webhook URL: `https://api.yourdomain.com/api/v1/webhooks/meta` (same as other Meta webhooks)  
5. Subscribe to `messages` on the WABA  

Each workspace **Enable WhatsApp** creates a tenant record; all send/receive uses your platform number. Inbound replies are routed to the workspace that owns the contact (or last outbound conversation).

**Optional BYO mode:** Leave `WHATSAPP_PLATFORM_*` unset — clients with their own Meta Business + WABA can use OAuth connect instead.

**Permissions to request in App Review:**
- `pages_manage_posts`, `pages_read_engagement`, `pages_manage_engagement`
- `instagram_content_publish`, `instagram_manage_comments`
- `pages_show_list`, `instagram_basic`

Users must **reconnect** Publisher Connect after approval to grant new scopes.

---

## 5. LinkedIn App

[LinkedIn Developers](https://developer.linkedin.com):

| Scope | Purpose |
|-------|---------|
| `w_member_social` | Publish posts |
| `r_member_social` | Read comments |

Set redirect URL: `https://api.yourdomain.com/api/v1/social-accounts/oauth/linkedin/callback`

---

## 6. Media for social publishing

Facebook/Instagram fetch media from **public HTTPS URLs**.

**Recommended:** Supabase Storage (already wired) — set bucket `media` to public.

**Alternative:** `API_PUBLIC_URL=https://api.yourdomain.com` with `/uploads` served over HTTPS (not localhost).

---

## 7. Background jobs (in-process cron)

| Cron | Interval | Env toggle |
|------|----------|------------|
| Auto-publish scheduled content | 5 min | `AUTO_PUBLISH_CRON_ENABLED` |
| Daily AI workflow | 8:00 daily | `DAILY_WORKFLOW_CRON_ENABLED` |
| Comment sync + auto-reply | 10 min | `COMMENT_SYNC_CRON_ENABLED` (enqueues BullMQ job when `QUEUES_ENABLED=true`) |

For multiple API instances, run crons on one instance only or use Redis/BullMQ (`QUEUES_ENABLED=true`, `REDIS_HOST`).

### Redis / BullMQ

```env
REDIS_HOST=localhost
REDIS_PORT=6379
QUEUES_ENABLED=true
```

Queues: `content-publish`, `comments`, `webhooks`, `ai`, `email`. Job status: `GET /api/v1/queues/:queue/jobs/:jobId`.

---

## 8. Pre-launch checklist

- [ ] `DB_SYNCHRONIZE=false` + migration applied
- [ ] Strong `JWT_SECRET` and `SESSION_SECRET`
- [ ] `API_PUBLIC_URL` is public HTTPS
- [ ] Supabase storage configured OR uploads on persistent volume
- [ ] Legal pages live at `/privacy`, `/terms`, `/data-deletion`
- [ ] Meta Data Deletion Callback registered
- [ ] OAuth callback URLs updated to production domains
- [ ] `PAYMENTS_DEV_AUTO_COMPLETE=false`
- [ ] `CORS_ORIGIN` matches Firebase Hosting URL (see `docs/FIREBASE_HOSTING.md`)
- [ ] Publish test post → verify `content_publications` row + comment sync

---

## 9. Smoke test

```bash
# Health
curl https://api.yourdomain.com/privacy.html

# Login
curl -X POST https://api.yourdomain.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@brandpilot.test","password":"password123"}'
```

Then in the app: connect social → publish → Replies → Pull Latest Comments.
