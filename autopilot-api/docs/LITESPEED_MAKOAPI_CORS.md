# LiteSpeed makoapi — no duplicate CORS

Firebase (`mako-33f20.web.app`) calls the API on `makoapi.tekreminnovations.com`. CORS is handled **only by NestJS** via `app.enableCors()` in `main.ts`.

CyberPanel’s UI vHost editor may **not** match the file LiteSpeed actually loads. Always edit:

```
/usr/local/lsws/conf/vhosts/makoapi.tekreminnovations.com/vhconf.conf
```

A clean reference config is in `docs/makoapi.vhconf.conf.example`.

## Remove duplicate CORS (common bug)

If `vhconf.conf` contains blocks like these, **delete them** (they duplicate Nest headers and use the wrong origin `mako.tekreminnovations.com`):

```apache
# DELETE — global extraHeaders CORS block
extraHeaders <<<END_extraHeaders
Access-Control-Allow-Origin: https://mako.tekreminnovations.com
...
END_extraHeaders

# DELETE — OPTIONS rewrite (Nest handles preflight)
rewrite { ... RewriteCond %{REQUEST_METHOD} OPTIONS ... }

# DELETE — CORS inside context / extraHeaders
context / {
  extraHeaders <<<END_extraHeaders
  Access-Control-Allow-Origin: https://mako.tekreminnovations.com
  ...
  END_extraHeaders
}
```

Also fix SSL if it points at `mako.tekreminnovations.com` certs — use **makoapi** certs:

```apache
vhssl {
  keyFile   /etc/letsencrypt/live/makoapi.tekreminnovations.com/privkey.pem
  certFile  /etc/letsencrypt/live/makoapi.tekreminnovations.com/fullchain.pem
  certChain 1
}
```

Then:

```bash
systemctl restart lsws
```

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
