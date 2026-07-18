# Social Authentication

This document describes how to configure and use social login with **Google**, **Facebook**, **LinkedIn**, and **Instagram** in the SocialOS API.

All social auth routes live under:

```
/api/v1/auth
```

Interactive API docs (Swagger) are available at `/api` when the server is running.

---

## Architecture: direct NestJS OAuth

SocialOS handles authentication **entirely inside the NestJS API** — not via Supabase Auth or a third-party IdP. Each provider's OAuth flow runs server-side; the API validates tokens, manages users in your Postgres database, and issues platform JWTs signed with `JWT_SECRET`.

This approach is a good fit when you:

- Want auth fully inside your stack (no external auth service dependency)
- Need **server-only OAuth** for cron jobs, background token exchange, or API-to-API flows
- Have compliance requirements to keep identity data on your own servers
- Prefer a dedicated IdP you control (or may migrate to Auth0, Cognito, or Keycloak later) rather than Supabase Auth

**Trade-off:** You manage OAuth app registration, credentials, and token lifecycle per provider. The sections below walk through obtaining each key.

---

## Overview

Social authentication supports two integration patterns:

| Pattern | Best for | How it works |
|---------|----------|--------------|
| **Browser redirect (OAuth)** | Web apps | User visits a login URL, signs in with the provider, and is redirected back to your API callback with an authorization code or access token. |
| **Token exchange** | Mobile apps & SPAs using provider SDKs | Client obtains an access token from the provider SDK and sends it to the API. The API validates the token, creates or finds the user, and returns platform JWTs. |

After a successful login (either pattern), the API returns a **platform access token** and **refresh token**. Use the access token as a Bearer token for protected routes such as `GET /api/v1/auth/me`.

---

## Authentication flows

### Browser redirect flow

```mermaid
sequenceDiagram
    participant User
    participant App as Your frontend
    participant API as SocialOS API
    participant Provider as OAuth provider

    User->>App: Click "Sign in with Google"
    App->>API: GET /api/v1/auth/google
    API->>Provider: Redirect to provider login
    Provider->>User: Show login / consent screen
    User->>Provider: Approve
    Provider->>API: GET /api/v1/auth/google/redirect?code=...
    API->>Provider: Exchange code / validate profile
    API->>API: Find or create user
    API->>App: JSON { user, token, refreshToken }
```

LinkedIn and Instagram follow the same shape, but the API builds the authorization URL itself instead of using Passport:

- `GET /api/v1/auth/linkedin` → redirects to LinkedIn
- `GET /api/v1/auth/instagram` → redirects to Instagram

### Token exchange flow

```mermaid
sequenceDiagram
    participant Client as Mobile / SPA
    participant Provider as Provider SDK
    participant API as SocialOS API

    Client->>Provider: Sign in via SDK
    Provider->>Client: Provider access token
    Client->>API: POST /api/v1/auth/google-auth { "token": "..." }
    API->>Provider: Validate token / fetch profile
    API->>API: Find or create user
    API->>Client: JSON { user, token, refreshToken }
```

---

## API endpoints

### Google

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/auth/google` | Start Google OAuth (redirects to Google) |
| `GET` | `/api/v1/auth/google/redirect` | Google OAuth callback |
| `POST` | `/api/v1/auth/google-auth` | Authenticate with a Google access token |

### Facebook

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/auth/facebook` | Start Facebook OAuth (redirects to Facebook) |
| `GET` | `/api/v1/auth/facebook/redirect` | Facebook OAuth callback |
| `POST` | `/api/v1/auth/facebook-auth` | Authenticate with a Facebook access token |

### LinkedIn

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/auth/linkedin` | Start LinkedIn OAuth (redirects to LinkedIn) |
| `GET` | `/api/v1/auth/linkedin/redirect` | LinkedIn OAuth callback |
| `POST` | `/api/v1/auth/linkedin-auth` | Authenticate with a LinkedIn access token |

### Instagram

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/auth/instagram` | Start Instagram OAuth (redirects to Instagram) |
| `GET` | `/api/v1/auth/instagram/redirect` | Instagram OAuth callback |
| `POST` | `/api/v1/auth/instagram-auth` | Authenticate with an Instagram access token |

### Session management (all providers)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/auth/refresh` | Public | Refresh an access token |
| `POST` | `/api/v1/auth/logout` | Bearer JWT | Revoke refresh token |
| `GET` | `/api/v1/auth/me` | Bearer JWT | Get current user profile |

---

## Request & response formats

### Token exchange request

All `*-auth` endpoints accept the same body:

```json
{
  "token": "provider-access-token"
}
```

Example:

```bash
curl -X POST http://localhost:4000/api/v1/auth/google-auth \
  -H "Content-Type: application/json" \
  -d '{"token": "ya29.a0AfH6..."}'
```

### Successful login response

All social login endpoints return:

```json
{
  "user": {
    "id": 1,
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane@example.com",
    "role": "USER",
    "avatar": "https://...",
    "token": "eyJhbGciOiJIUzI1NiIs..."
  },
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

- **`token`** — Platform JWT access token (default expiry: 1 hour). Send as `Authorization: Bearer <token>`.
- **`refreshToken`** — Platform refresh token (default expiry: 7 days).

### Refresh token request

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

Response:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

> **Note:** The login response uses the field name `token`, while the refresh response uses `accessToken`.

### Protected route example

```bash
curl http://localhost:4000/api/v1/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

---

## Environment variables

Copy `.env.example` to `.env` and fill in the values below.

```env
# Required for all social logins
JWT_SECRET=your-jwt-secret

# Google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:4000/api/v1/auth/google/redirect

# Facebook
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
FACEBOOK_CALLBACK_URL=http://localhost:4000/api/v1/auth/facebook/redirect

# LinkedIn
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_CALLBACK_URL=http://localhost:4000/api/v1/auth/linkedin/redirect

# Instagram (Meta app)
INSTAGRAM_CLIENT_ID=
INSTAGRAM_CLIENT_SECRET=
INSTAGRAM_CALLBACK_URL=http://localhost:4000/api/v1/auth/instagram/redirect
INSTAGRAM_GRAPH_URL=https://graph.instagram.com
```

The default server port is **4000** (`PORT` in `.env`). Update callback URLs if you use a different port or deploy to production.

Google and Facebook strategies require their env vars at startup. The app will not boot if `GOOGLE_*` or `FACEBOOK_*` values are missing.

---

## Provider setup — how to get your keys

Each provider requires an OAuth app registered in their developer console. The tables below map **console field names** → **`.env` variable names**.

For production, replace `localhost:4000` with your deployed API URL (e.g. `https://api.yourdomain.com`).

---

### Google

| Console field | `.env` variable |
|---------------|-----------------|
| Client ID | `GOOGLE_CLIENT_ID` |
| Client secret | `GOOGLE_CLIENT_SECRET` |
| Authorized redirect URI | `GOOGLE_CALLBACK_URL` |

**Step-by-step**

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and sign in.
2. Create a project (top bar → **Select a project → New Project**) or pick an existing one.
3. Open **APIs & Services → OAuth consent screen**:
   - User type: **External** (or Internal if using Google Workspace)
   - Fill in app name, support email, and developer contact
   - Scopes: add `.../auth/userinfo.email` and `.../auth/userinfo.profile`
   - Add test users if the app is in **Testing** mode (only listed users can sign in until published)
4. Open **APIs & Services → Credentials → + Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Name: e.g. `SocialOS API`
   - **Authorized JavaScript origins** (optional for server-side flow): `http://localhost:5173` and `http://localhost:4000`
   - **Authorized redirect URIs** — add exactly:
     ```
     http://localhost:4000/api/v1/auth/google/redirect
     ```
5. Click **Create**. A dialog shows your credentials:
   - **Client ID** → `GOOGLE_CLIENT_ID`
   - **Client secret** → `GOOGLE_CLIENT_SECRET` (click **Download JSON** or copy from the credentials list later via the pencil icon)
6. Set in `.env`:
   ```env
   GOOGLE_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxx
   GOOGLE_CALLBACK_URL=http://localhost:4000/api/v1/auth/google/redirect
   ```

**Scopes used by the API:** `email`, `profile`

**Where to find keys later:** Credentials → OAuth 2.0 Client IDs → click your client name.

---

### Facebook

| Console field | `.env` variable |
|---------------|-----------------|
| App ID | `FACEBOOK_APP_ID` |
| App secret | `FACEBOOK_APP_SECRET` |
| Valid OAuth Redirect URI | `FACEBOOK_CALLBACK_URL` |

**Step-by-step**

1. Go to [Meta for Developers](https://developers.facebook.com/) → **My Apps → Create App**.
2. Use case: **Authenticate and request data from users with Facebook Login** (or **Other** → Consumer).
3. Enter app name and contact email → **Create app**.
4. From the app dashboard, add the **Facebook Login** product → choose **Web**.
5. Open **Facebook Login → Settings** (left sidebar under Facebook Login):
   - **Valid OAuth Redirect URIs** — add:
     ```
     http://localhost:4000/api/v1/auth/facebook/redirect
     ```
   - Save changes.
6. Get your keys from **App settings → Basic** (left sidebar):
   - **App ID** → `FACEBOOK_APP_ID`
   - **App secret** — click **Show**, confirm password → `FACEBOOK_APP_SECRET`
7. Set in `.env`:
   ```env
   FACEBOOK_APP_ID=1234567890123456
   FACEBOOK_APP_SECRET=abcdef1234567890abcdef1234567890
   FACEBOOK_CALLBACK_URL=http://localhost:4000/api/v1/auth/facebook/redirect
   ```

**Notes**

- Facebook only returns an email if the account has one and the user grants the `email` permission.
- In **Development** mode, only users with a role on the app (Admin, Developer, Tester) can log in. Switch to **Live** mode under **App Mode** when ready for production.
- Add your **Privacy Policy URL** and **App Domains** under Basic settings before going live.

---

### LinkedIn

| Console field | `.env` variable |
|---------------|-----------------|
| Client ID | `LINKEDIN_CLIENT_ID` |
| Primary Client Secret | `LINKEDIN_CLIENT_SECRET` |
| Authorized redirect URL | `LINKEDIN_CALLBACK_URL` |

**Step-by-step**

1. Go to [LinkedIn Developer Portal](https://www.linkedin.com/developers/) → **Create app**.
2. Fill in app name, LinkedIn Page (create a placeholder company page if needed), privacy policy URL, and app logo → **Create app**.
3. Open the **Auth** tab:
   - Under **OAuth 2.0 settings**, add **Authorized redirect URLs**:
     ```
     http://localhost:4000/api/v1/auth/linkedin/redirect
     ```
   - Copy **Client ID** → `LINKEDIN_CLIENT_ID`
   - Copy **Primary Client Secret** → `LINKEDIN_CLIENT_SECRET` (you can regenerate this if compromised)
4. Open the **Products** tab and request access to:
   - **Sign In with LinkedIn using OpenID Connect** — required for login
5. Once approved (often instant for OpenID Connect), confirm these scopes are available: `openid`, `profile`, `email`.
6. Set in `.env`:
   ```env
   LINKEDIN_CLIENT_ID=86xxxxxxxxxx
   LINKEDIN_CLIENT_SECRET=xxxxxxxxxxxxxxxx
   LINKEDIN_CALLBACK_URL=http://localhost:4000/api/v1/auth/linkedin/redirect
   ```

**Notes**

- The API fetches profile data from `https://api.linkedin.com/v2/userinfo` (OpenID Connect).
- LinkedIn apps start in development; verify your app under **Settings** before scaling to all users.

---

### Instagram

Instagram login uses a **Meta app** — you can reuse the same Meta developer account (and optionally the same app) as Facebook.

| Console field | `.env` variable |
|---------------|-----------------|
| Instagram App ID (same as Meta App ID) | `INSTAGRAM_CLIENT_ID` |
| Instagram App Secret (same as Meta App Secret) | `INSTAGRAM_CLIENT_SECRET` |
| OAuth redirect URI | `INSTAGRAM_CALLBACK_URL` |

**Step-by-step**

1. Go to [Meta for Developers](https://developers.facebook.com/) → open your app (or create one as in the Facebook section above).
2. From the app dashboard, click **Add Product** → find **Instagram** → **Set up**.
   - Choose **Instagram API with Instagram Login** (not the legacy Basic Display API).
3. Open **Instagram → API setup with Instagram login** (or **Instagram → Settings**):
   - Add **OAuth redirect URI**:
     ```
     http://localhost:4000/api/v1/auth/instagram/redirect
     ```
4. Get credentials from **App settings → Basic**:
   - **App ID** → `INSTAGRAM_CLIENT_ID`
   - **App secret** → `INSTAGRAM_CLIENT_SECRET`
5. Under **Instagram → API setup**, add an **Instagram test user** or connect a professional Instagram account while in Development mode.
6. Set in `.env`:
   ```env
   INSTAGRAM_CLIENT_ID=1234567890123456
   INSTAGRAM_CLIENT_SECRET=abcdef1234567890abcdef1234567890
   INSTAGRAM_CALLBACK_URL=http://localhost:4000/api/v1/auth/instagram/redirect
   INSTAGRAM_GRAPH_URL=https://graph.instagram.com
   ```

**Notes**

- If Facebook and Instagram share one Meta app, `INSTAGRAM_CLIENT_ID` / `SECRET` are the **same values** as `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET`. Keep separate env vars anyway so you can split apps later if needed.
- Scope used: `instagram_business_basic`.
- **Instagram does not return email.** The API creates accounts with a synthetic email: `instagram.{user_id}@instagram.auth`. The username is stored in `firstName`.
- Switch the Meta app to **Live** mode and complete **App Review** for Instagram permissions before public launch.

---

### Quick reference — all keys

| Provider | Where to get keys | Env vars |
|----------|-------------------|----------|
| Google | [Google Cloud Console](https://console.cloud.google.com/) → Credentials → OAuth 2.0 Client | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` |
| Facebook | [Meta for Developers](https://developers.facebook.com/) → App → Settings → Basic | `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_CALLBACK_URL` |
| LinkedIn | [LinkedIn Developers](https://www.linkedin.com/developers/) → App → Auth tab | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_CALLBACK_URL` |
| Instagram | [Meta for Developers](https://developers.facebook.com/) → App → Settings → Basic (+ Instagram product) | `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET`, `INSTAGRAM_CALLBACK_URL` |

---

## User records

On first social login, a user row is created in the `users` table. On subsequent logins, the existing user is matched by email (or synthetic Instagram email).

Provider registration flags on the user entity:

| Field | Set when |
|-------|----------|
| `isRegisteredWithGoogle` | First login via Google |
| `isRegisteredWithFacebook` | First login via Facebook |
| `isRegisteredWithLinkedIn` | First login via LinkedIn |
| `isRegisteredWithInstagram` | First login via Instagram |

---

## Implementation reference

| File | Purpose |
|------|---------|
| `src/modules/auth/auth.controller.ts` | Route definitions |
| `src/modules/auth/auth.service.ts` | JWT issuance, refresh, logout |
| `src/modules/auth/google-auth.service.ts` | Google token validation |
| `src/modules/auth/facebook-auth.service.ts` | Facebook token validation |
| `src/modules/auth/linkedin-auth.service.ts` | LinkedIn OAuth URL, code exchange, profile |
| `src/modules/auth/instagram-auth.service.ts` | Instagram OAuth URL, code exchange, profile |
| `src/modules/auth/strategies/google-stategy.ts` | Passport Google strategy (redirect flow) |
| `src/modules/auth/strategies/facebook-strategy.ts` | Passport Facebook strategy (redirect flow) |

---

## Testing locally

1. Set all required env vars in `.env`.
2. Start the server:
   ```bash
   npm run start:dev
   ```
3. Open a browser and visit a login URL, for example:
   ```
   http://localhost:4000/api/v1/auth/google
   ```
4. After consent, the callback returns JSON with tokens.

For token exchange, use a provider SDK or a short-lived access token from the provider's OAuth playground and call the matching `POST /api/v1/auth/*-auth` endpoint.

---

## Known limitations

- **OAuth callbacks return JSON**, not a redirect to your frontend. For production web apps, you may want to redirect to your client with tokens (e.g. via query params or a secure cookie). That frontend redirect is not implemented yet.
- **Refresh tokens are stored in memory** and are lost when the server restarts. Persist them in a database or Redis for production.
- **Instagram accounts** use synthetic emails because Instagram does not expose email addresses.
- **Provider apps in development mode** restrict who can log in (Google test users, Meta app roles, LinkedIn dev mode) until you publish or go live.

---

## Troubleshooting

| Problem | Likely cause |
|---------|--------------|
| App fails to start | Missing `GOOGLE_*` or `FACEBOOK_*` env vars |
| `redirect_uri_mismatch` | Callback URL in `.env` does not exactly match the provider console |
| Facebook login succeeds but no email | User has no email on Facebook or did not grant email permission |
| LinkedIn returns invalid token | OpenID Connect product not enabled, or wrong scopes |
| Instagram token exchange fails | Instagram product not added to Meta app, or wrong App ID/secret |
| `401` on `/auth/me` | Access token expired — call `POST /auth/refresh` with the refresh token |
