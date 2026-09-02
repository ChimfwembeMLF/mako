# Mobile API Client Contract

Mobile consumes existing `api-rust` REST endpoints. Base URL: `EXPO_PUBLIC_API_URL`.

## Auth headers

Authenticated routes:

```http
Authorization: Bearer <accessToken>
```

Always pass workspace scope via query or body as documented below (`tenantId`, `workspaceId`).

## Public auth (no 401-refresh loop)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/auth/login` | Email/password → `{ token, refreshToken, tenant, user }` |
| POST | `/api/v1/auth/register` | Sign-up |
| POST | `/api/v1/auth/google-auth` | Body `{ token }` |
| POST | `/api/v1/auth/refresh` | Body `{ refreshToken }` → `{ accessToken }` |
| POST | `/api/v1/auth/logout` | Revoke refresh (Bearer required) |

## Session / profile

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/auth/me` | `{ user, tenant }` |
| GET | `/api/v1/workspaces?tenantId=` | List workspaces |

## Content

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/content-items?tenantId=&workspaceId=` | List drafts/scheduled/published |
| POST | `/api/v1/content-items` | Create draft (include tenantId, workspaceId) |
| GET | `/api/v1/content-items/{id}` | Detail |
| PATCH | `/api/v1/content-items/{id}` | Update copy/schedule/platforms |
| POST | `/api/v1/content-items/{id}/media` | Attach media refs |
| POST | `/api/v1/content-ai/{contentId}/publish` | Publish now / queue publish |
| POST | `/api/v1/media/upload` | Upload binary; returns asset URL/id |

## Connections

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/social-accounts/tenant/{tenantId}?workspaceId=` | List accounts |
| GET | `/api/v1/social-accounts/oauth/{platform}/authorize?tenantId=&returnUrl=&workspaceId=` | Start OAuth → `{ redirectUrl }` |
| POST | `/api/v1/social-accounts/facebook/finalize` | Page pick after Meta OAuth |
| DELETE/disconnect | Existing disconnect endpoint used by web | Remove connection |

(Instagram/LinkedIn/etc. follow the same authorize + platform finalize patterns already used by web.)

## Inbox

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/inbox/conversations?tenantId=&workspaceId=&channel=` | List |
| GET | `/api/v1/inbox/messages?tenantId=&conversationId=&workspaceId=` | Thread |
| POST | `/api/v1/inbox/sync` | Body `{ tenantId, workspaceId }` |
| POST | `/api/v1/inbox/messages/reply` | Body `{ tenantId, conversationId, message, workspaceId }` |

## Client rules

1. **Public vs authed fetch**: Login/register/google/refresh MUST NOT trigger session-expiry sign-out on 401.
2. **401 on authed routes**: Attempt refresh once; then sign out and clear query cache.
3. **Isolation**: Never omit `workspaceId` once an active workspace is selected for content/inbox/connections mutations.
4. **Errors**: Map network/timeout to FR-011 user-facing strings; surface API `message` for 4xx.

## Out of contract (deferred)

Ads, Brand Brain, Analytics, Team admin, Billing, Mail, Chatbot, WhatsApp hub-only APIs.
