# Firebase Hosting + API on makoapi (cross-origin)

The SPA runs on **Firebase Hosting** (`*.web.app` or a custom domain). The NestJS API stays on your VPS at **`https://makoapi.tekreminnovations.com`**. The browser calls the API cross-origin; the API sends CORS headers for your Firebase origin.

No LiteSpeed `/api` proxy is required on `mako.tekreminnovations.com` for the main app.

## Architecture

| Component | URL |
|-----------|-----|
| Frontend (Firebase) | `https://YOUR_PROJECT.web.app` or custom domain |
| API (PM2 on VPS) | `https://makoapi.tekreminnovations.com` |
| Widget embeds | `/api/v1/widget/*` — permissive CORS for third-party sites |

---

## 1. Firebase project

1. Create a project at [Firebase Console](https://console.firebase.google.com).
2. Enable **Hosting**.
3. Install CLI (already in `devDependencies` — no global install needed):

```bash
cd autopilot-client
yarn install
yarn firebase login
yarn firebase use --add    # pick your project; writes .firebaserc
```

Or copy `.firebaserc.example` → `.firebaserc` and replace `your-firebase-project-id` with your real project ID (all lowercase, from Firebase Console).

Optional: add a **custom domain** in Firebase Hosting → Custom domains (e.g. `app.tekreminnovations.com`).

---

## 2. Client build & deploy

`autopilot-client/.env.production`:

```env
VITE_API_BASE_URL=https://makoapi.tekreminnovations.com
VITE_WIDGET_API_KEY=pk_live_...
```

```bash
cd autopilot-client
yarn install
yarn deploy:firebase
# or: yarn build:firebase && firebase deploy --only hosting
```

`firebase.json` already configures SPA fallback (`**` → `index.html`).

**Local dev:** keep `VITE_API_BASE_URL` empty in `.env` — Vite proxies `/api` to `localhost:4000`.

---

## 3. API `.env` (server)

Update production `.env` on the VPS:

```env
FRONTEND_URL=https://YOUR_PROJECT.web.app
API_PUBLIC_URL=https://makoapi.tekreminnovations.com
CORS_ORIGIN=https://YOUR_PROJECT.web.app

# If you use a custom Firebase domain too, comma-separate:
# CORS_ORIGIN=https://YOUR_PROJECT.web.app,https://app.tekreminnovations.com

# OAuth callbacks stay on the API host
GOOGLE_CALLBACK_URL=https://makoapi.tekreminnovations.com/api/v1/auth/google/redirect
FACEBOOK_CALLBACK_URL=https://makoapi.tekreminnovations.com/api/v1/auth/facebook/redirect
LINKEDIN_CALLBACK_URL=https://makoapi.tekreminnovations.com/api/v1/auth/linkedin/redirect
INSTAGRAM_CALLBACK_URL=https://makoapi.tekreminnovations.com/api/v1/auth/instagram/redirect
LINKEDIN_SOCIAL_CALLBACK_URL=https://makoapi.tekreminnovations.com/api/v1/social-accounts/oauth/linkedin/callback
FACEBOOK_SOCIAL_CALLBACK_URL=https://makoapi.tekreminnovations.com/api/v1/social-accounts/oauth/facebook/callback
GOOGLE_SOCIAL_CALLBACK_URL=https://makoapi.tekreminnovations.com/api/v1/social-accounts/oauth/google/callback
YOUTUBE_SOCIAL_CALLBACK_URL=https://makoapi.tekreminnovations.com/api/v1/social-accounts/oauth/youtube/callback
INSTAGRAM_SOCIAL_CALLBACK_URL=https://makoapi.tekreminnovations.com/api/v1/social-accounts/oauth/instagram/callback
TIKTOK_SOCIAL_CALLBACK_URL=https://makoapi.tekreminnovations.com/api/v1/social-accounts/oauth/tiktok/callback
WHATSAPP_SOCIAL_CALLBACK_URL=https://makoapi.tekreminnovations.com/api/v1/social-accounts/oauth/whatsapp/callback

PRIVACY_POLICY_URL=https://makoapi.tekreminnovations.com/privacy
TERMS_OF_SERVICE_URL=https://makoapi.tekreminnovations.com/terms
```

Restart API after changes:

```bash
cd autopilot-api
git pull
yarn build
pm2 restart "Mako API Production" --update-env
```

`FRONTEND_URL` is merged into allowed CORS origins automatically; set `CORS_ORIGIN` explicitly for clarity.

---

## 4. OAuth provider consoles

Update redirect URIs in **Google Cloud**, **Meta Developer**, and **LinkedIn Developer** to use **`makoapi.tekreminnovations.com`** (not Firebase URL). OAuth flow:

1. User clicks login on Firebase app
2. Redirect to `makoapi.../api/v1/auth/google`
3. Provider callback to `makoapi.../api/v1/auth/google/redirect`
4. API redirects to `FRONTEND_URL/auth/callback?token=...`

---

## 5. Verify

```bash
# API healthy
curl -s https://makoapi.tekreminnovations.com/api/v1/health
# expect: "apiMode":"cross-origin"

# CORS preflight from Firebase origin (replace URL)
curl -s -D - -o /dev/null -X OPTIONS \
  -H "Origin: https://YOUR_PROJECT.web.app" \
  -H "Access-Control-Request-Method: GET" \
  https://makoapi.tekreminnovations.com/api/v1/health
# expect: Access-Control-Allow-Origin: https://YOUR_PROJECT.web.app
```

In the browser (Firebase app) → Network: requests go to `makoapi.tekreminnovations.com`, no CORS errors.

---

## 6. Meta App Review URLs

| Field | URL |
|-------|-----|
| Privacy Policy | `https://makoapi.tekreminnovations.com/privacy` or Firebase `/privacy` if you host a page there |
| Terms | `https://makoapi.tekreminnovations.com/terms` |
| Data Deletion | `https://YOUR_PROJECT.web.app/data-deletion` |
| Webhooks | `https://makoapi.tekreminnovations.com/api/v1/webhooks/...` |

---

## 7. Troubleshooting CORS

### Duplicate `Access-Control-Allow-Origin` header

If the browser reports:

> The 'Access-Control-Allow-Origin' header contains multiple values 'https://..., https://...'

**Cause:** LiteSpeed on `makoapi.tekreminnovations.com` is adding CORS headers **and** NestJS is also adding them. Browsers reject duplicated values.

**Fix:** On the **`makoapi`** vhost only, remove any LiteSpeed/CyberPanel CORS configuration:

- CyberPanel → Websites → **makoapi.tekreminnovations.com** → vHost Conf / Rewrite Rules
- Delete `Header set Access-Control-*` rules, `extraHeaders` with `Access-Control-*`, or “Enable CORS” toggles
- CORS must be handled **only by NestJS** (`CORS_ALLOW_ALL=true` in `.env`)

Then:

```bash
systemctl restart lsws
```

Verify a **single** origin header:

```bash
curl -s -D - -o /dev/null -X OPTIONS \
  -H "Origin: https://mako-33f20.web.app" \
  -H "Access-Control-Request-Method: GET" \
  https://makoapi.tekreminnovations.com/api/v1/plans | grep -i access-control-allow-origin
```

Expected: **one** line, e.g. `access-control-allow-origin: https://mako-33f20.web.app`

---

## Same-origin alternative

If you later host the SPA on CyberPanel with a LiteSpeed `/api` proxy, see `docs/SAME_ORIGIN_PROXY.md`.
