# LiteSpeed makoapi — no duplicate CORS

Firebase (`mako-33f20.web.app`) calls the API on `makoapi.tekreminnovations.com`. CORS is handled **only by NestJS** via `app.enableCors()` in `main.ts`.

**Do not** add `Access-Control-*` headers on the makoapi LiteSpeed vhost — that causes duplicate `Access-Control-Allow-Origin` and browsers block the request.

## Correct makoapi vhost (proxy only)

```apache
context / {
  type                    proxy
  handler                 node_backend
  addDefaultCharset       off
}
```

No `extraHeaders` for CORS.

## Server `.env`

```env
CORS_ORIGIN=https://mako-33f20.web.app,http://localhost:5173,http://localhost:3000
CORS_CREDENTIALS=true
FRONTEND_URL=https://mako-33f20.web.app
```

Or allow any origin:

```env
CORS_ALLOW_ALL=true
```

Do **not** set `CORS_DISABLED=true` unless LiteSpeed is the only layer adding CORS headers.

## Deploy

```bash
git pull && yarn build && pm2 restart "Mako API Production" --update-env
systemctl restart lsws
```

## Verify

```bash
curl -s -D - -o /dev/null \
  -H "Origin: https://mako-33f20.web.app" \
  https://makoapi.tekreminnovations.com/api/v1/plans | grep -i access-control-allow-origin
```

Expected — **one** line:

```
access-control-allow-origin: https://mako-33f20.web.app
```

Health check:

```bash
curl -s https://makoapi.tekreminnovations.com/api/v1/health
# corsBuild: "cors-v13"
```
