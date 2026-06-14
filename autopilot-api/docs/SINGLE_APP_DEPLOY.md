# Single app deploy — Nest serves React + API (Laravel-style)

One Node process serves the React SPA and the API. The browser only talks to **one domain**; no LiteSpeed `/api` proxy rules required.

## Architecture

```
Browser → https://yourdomain.com
              │
              ▼
         LiteSpeed (optional)
         context / → 127.0.0.1:4005
              │
              ▼
         NestJS :4005
         ├── /api/v1/*     API routes
         ├── /uploads/*    uploads
         ├── /documentation Swagger
         ├── /admin/*      Bull Board
         └── /*            React SPA (client/dist)
```

No CORS. No separate `makoapi` subdomain for the app.

---

## 1. Build (local or CI)

From the repo root:

```bash
cd autopilot-api
yarn install
yarn build:all
```

This runs:

1. `yarn build:client` — Vite build with empty `VITE_API_BASE_URL` (same-origin `/api/v1/...`)
2. `yarn copy:client` — copies `autopilot-client/dist` → `autopilot-api/client/dist`
3. `yarn build` — compiles Nest

---

## 2. Server `.env`

```env
NODE_ENV=production
PORT=4005
SERVE_CLIENT=true
CORS_DISABLED=true

FRONTEND_URL=https://yourdomain.com
API_PUBLIC_URL=https://yourdomain.com

GOOGLE_CALLBACK_URL=https://yourdomain.com/api/v1/auth/google/redirect
FACEBOOK_CALLBACK_URL=https://yourdomain.com/api/v1/auth/facebook/redirect
LINKEDIN_CALLBACK_URL=https://yourdomain.com/api/v1/auth/linkedin/redirect
INSTAGRAM_CALLBACK_URL=https://yourdomain.com/api/v1/auth/instagram/redirect
# ... social OAuth callbacks on the same domain
```

Register the same redirect URIs in Google / Meta / LinkedIn developer consoles.

---

## 3. LiteSpeed (minimal — no path proxying)

Point the whole vhost at Nest:

```apache
extprocessor node_backend {
  type                    proxy
  address                 127.0.0.1:4005
  maxConns                100
  initTimeout             60
  retryTimeout            0
  respBuffer              0
}

context / {
  type                    proxy
  handler                 node_backend
  addDefaultCharset       off
}
```

No separate `/api` context. Nest handles routing.

---

## 4. Deploy on VPS

```bash
cd /path/to/autopilot-api
yarn deploy:prod    # install + build client & API + migrate + PM2 restart
# or without migrations:
yarn deploy:pm2
```

---

## 5. Verify

```bash
curl -s http://127.0.0.1:4005/api/v1/health
# "serveClient": true, "apiMode": "same-origin"

curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4005/
# 200 — React index.html

curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4005/api/v1/plans
# 200
```

Open `https://yourdomain.com` — Network tab should show `/api/v1/...` on the **same host**.

---

## Local development

| Terminal | Command |
|----------|---------|
| API | `cd autopilot-api && yarn start:dev` (port 4000) |
| Client | `cd autopilot-client && yarn dev` (port 3000, proxies `/api` → 4000) |

Keep `VITE_API_BASE_URL` empty in `autopilot-client/.env`.

---

## Disable SPA serving (API-only mode)

```env
SERVE_CLIENT=false
```

Use when running Firebase or a separate frontend with cross-origin CORS.
