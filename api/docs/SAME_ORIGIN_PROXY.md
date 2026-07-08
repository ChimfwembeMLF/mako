# Same-origin API proxy (mako.tekreminnovations.com)

The SPA and API share one origin. The browser calls `https://mako.tekreminnovations.com/api/v1/...`; LiteSpeed proxies those requests to NestJS on `127.0.0.1:4005`. **No global CORS** is required for the main app.

The embeddable chatbot widget (`/api/v1/widget/*`) still sends CORS headers for third-party sites that embed the widget.

## Architecture

| Public URL | Proxied to |
|------------|------------|
| `https://mako.tekreminnovations.com/api/*` | `http://127.0.0.1:4005/api/*` |
| `https://mako.tekreminnovations.com/uploads/*` | `http://127.0.0.1:4005/uploads/*` |
| `https://mako.tekreminnovations.com/documentation` | `http://127.0.0.1:4005/documentation` |
| `https://mako.tekreminnovations.com/admin/*` | `http://127.0.0.1:4005/admin/*` |
| `https://mako.tekreminnovations.com/privacy.html` | `http://127.0.0.1:4005/privacy.html` |
| `https://mako.tekreminnovations.com/terms.html` | `http://127.0.0.1:4005/terms.html` |

Static SPA files (`/`, `/auth`, `/dashboard`, …) are served from `dist/` as usual.

`makoapi.tekreminnovations.com` is **optional** after this change (can redirect to `mako` or stay as a direct API alias).

---

## 1. CyberPanel / OpenLiteSpeed — proxy contexts

On **`mako.tekreminnovations.com`** (frontend vhost), add **Proxy** contexts **above** the SPA/static handler.

### CyberPanel UI

1. **Websites → List Websites → mako.tekreminnovations.com → Manage**
2. **Rewrite Rules** or **vHost Conf** → add proxy contexts (order matters — API before catch-all)

### vHost snippet (OpenLiteSpeed)

```apache
context /api {
  type                    proxy
  handler                 127.0.0.1:4005
  addDefaultCharset       off
}

context /uploads {
  type                    proxy
  handler                 127.0.0.1:4005
  addDefaultCharset       off
}

context /documentation {
  type                    proxy
  handler                 127.0.0.1:4005
  addDefaultCharset       off
}

context /admin {
  type                    proxy
  handler                 127.0.0.1:4005
  addDefaultCharset       off
}
```

Restart LiteSpeed after saving:

```bash
systemctl restart lsws
```

---

## 2. API `.env` (server)

```env
FRONTEND_URL=https://mako.tekreminnovations.com
API_PUBLIC_URL=https://mako.tekreminnovations.com
PORT=4005

# OAuth — same host as frontend
GOOGLE_CALLBACK_URL=https://mako.tekreminnovations.com/api/v1/auth/google/redirect
FACEBOOK_CALLBACK_URL=https://mako.tekreminnovations.com/api/v1/auth/facebook/redirect
LINKEDIN_CALLBACK_URL=https://mako.tekreminnovations.com/api/v1/auth/linkedin/redirect
INSTAGRAM_CALLBACK_URL=https://mako.tekreminnovations.com/api/v1/auth/instagram/redirect
LINKEDIN_SOCIAL_CALLBACK_URL=https://mako.tekreminnovations.com/api/v1/social-accounts/oauth/linkedin/callback
FACEBOOK_SOCIAL_CALLBACK_URL=https://mako.tekreminnovations.com/api/v1/social-accounts/oauth/facebook/callback
GOOGLE_SOCIAL_CALLBACK_URL=https://mako.tekreminnovations.com/api/v1/social-accounts/oauth/google/callback
YOUTUBE_SOCIAL_CALLBACK_URL=https://mako.tekreminnovations.com/api/v1/social-accounts/oauth/youtube/callback
INSTAGRAM_SOCIAL_CALLBACK_URL=https://mako.tekreminnovations.com/api/v1/social-accounts/oauth/instagram/callback
TIKTOK_SOCIAL_CALLBACK_URL=https://mako.tekreminnovations.com/api/v1/social-accounts/oauth/tiktok/callback
WHATSAPP_SOCIAL_CALLBACK_URL=https://mako.tekreminnovations.com/api/v1/social-accounts/oauth/whatsapp/callback
```

Update the same redirect URIs in **Google Cloud Console**, **Meta Developer**, and **LinkedIn Developer**.

`CORS_ORIGIN` is no longer needed for the main app.

---

## 3. Client build

```env
# resources/client/.env.production.local
# Empty = same origin (recommended)
VITE_API_BASE_URL=
VITE_WIDGET_API_KEY=pk_live_...
```

```bash
cd autopilot-api/resources/client
yarn build
# Deploy dist/ to mako.tekreminnovations.com public_html
```

---

## 4. Verify

```bash
# Proxy working (via public URL)
curl -s https://mako.tekreminnovations.com/api/v1/health

# Direct to Node (on server)
curl -s http://127.0.0.1:4005/api/v1/health

# PM2
pm2 logs "Mako API Production" --lines 20
```

In the browser DevTools → Network, requests should go to `mako.tekreminnovations.com/api/v1/...` with **no CORS errors**.

---

## 5. Local development

`vite.config.ts` proxies `/api` to `http://localhost:4000`. Leave `VITE_API_BASE_URL` empty in `.env` so the client uses `http://localhost:3000` (same origin as the Vite dev server).
