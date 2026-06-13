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

Run TypeORM migrations once:
```bash
cd autopilot-api
# Set DB_* in .env, then:
npm run db:migrate
npm run db:migrate:show   # optional — list applied migrations
```

---

## 2. API environment (required)

Copy `docs/env.mako.production.template` (or `docs/env.production.template`) to `.env` on your server and fill in values.

Build & start with PM2 (production):
```bash
cd autopilot-api
cp docs/env.mako.production.template .env   # then edit secrets
npm ci
npm run build
npm run migrations:run
# After first owner signs up (or if tenant already exists):
npm run seed:prod
npm run pm2:start

# After code updates
npm run deploy:prod

npm run pm2:status
npm run pm2:logs
npm run pm2:save
npm run pm2:startup   # run the sudo command it prints
```

| Variable | Production value |
|----------|------------------|
| `PORT` | `5000` (see `config/production.yml`) |
| `NODE_ENV` | `production` |
| `DB_SYNCHRONIZE` | `false` |
| `JWT_SECRET` | Strong random string |
| `SESSION_SECRET` | Strong random string (required — app exits if missing) |
| `API_PUBLIC_URL` | `https://api.yourdomain.com` |
| `FRONTEND_URL` | `https://app.yourdomain.com` |
| `CORS_ORIGIN` | `https://app.yourdomain.com` |
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

**Process file:** `ecosystem.config.json` (PM2 app name: `autopilot-api`, port `5000` in production).

```bash
# Direct PM2 (equivalent to npm run pm2:start)
npx pm2 start ecosystem.config.json --env production
npx pm2 startOrRestart ecosystem.config.json --env production --update-env
```

Secrets live in `.env` on the server — NestJS loads them at boot; PM2 does not parse `.env`.

---

## 3. Client environment

```env
# Protocol-relative — matches page protocol (http or https)
VITE_API_BASE_URL=//makoapi.tekreminnovations.com
```

| Host | Role |
|------|------|
| `mako.tekreminnovations.com` | Frontend (static SPA) |
| `makoapi.tekreminnovations.com` | API (NestJS / PM2) |

Build & deploy static files:
```bash
cd autopilot-client
npm ci
npm run build
# Deploy dist/ to CDN / Vercel / Netlify / nginx
```

Configure SPA fallback: all routes → `index.html`.

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
- [ ] CORS limited to your frontend origin
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
