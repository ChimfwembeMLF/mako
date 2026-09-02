# Mobile API Client Contract (Hardening)

Extends `specs/005-mobile-core-features/contracts/mobile-api.md`. Base URL: `EXPO_PUBLIC_API_URL`. Live runtime: **api-rust**.

## Auth / session (unchanged rules)

- Public: login / register / google-auth / refresh → **no** session-expiry sign-out on 401.
- Authed: 401 → refresh once → retry; else sign out + `queryClient.clear()`.
- **Media upload** MUST follow the same refresh/retry rule (multipart).

## Google config

- Google sign-in requires configured public client env (`EXPO_PUBLIC_GOOGLE_*` as documented in `.env.example`).
- If unset: disable Google CTA; show configuration error — **never** dummy client IDs.

## Content / publish

| Method | Path | Notes |
|--------|------|--------|
| PATCH | `/api/v1/content-items/{id}` | Save-before-publish; cancel-schedule (`status: draft`, clear schedule fields) |
| POST | `/api/v1/content-items/{id}/media` | After upload |
| POST | `/api/v1/media/upload` | Multipart; refresh-aware |
| POST | `/api/v1/content-ai/{id}/publish` | Body `{ platforms }` — platforms ⊆ connected |

**Client rule**: Existing draft → save (and attach pending media) **before** publish.

## Connections (expanded)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/social-accounts/oauth/{platform}/authorize` | facebook, instagram, linkedin, youtube, tiktok, twitter, whatsapp |
| GET | `/api/v1/social-accounts/facebook/setup` + POST `.../facebook/finalize` | Meta page pick |
| GET | `/api/v1/social-accounts/youtube/setup` + POST `.../youtube/finalize` | Channel pick |
| GET | `/api/v1/social-accounts/whatsapp/setup` (+ setup-from-meta) + POST `.../whatsapp/finalize` | Phone pick (publisher connect only) |
| POST | `/api/v1/social-accounts/{id}/disconnect` | Disconnect |

TikTok/Twitter follow web authorize (+ manual/webhook helpers if web uses them). No WhatsApp hub/templates endpoints in this feature.

## Inbox + comments

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/inbox/conversations?tenantId=&workspaceId=&channel=` | `all` \| `dm` \| `post_comment` — **Rust MUST return post_comment rows** (Nest parity) |
| GET | `/api/v1/inbox/messages?...` | DM thread |
| POST | `/api/v1/inbox/sync` | Sync DMs (+ comment fetch as web does) |
| POST | `/api/v1/inbox/messages/reply` | Response `{ sent: boolean, message?: string }` |
| GET | `/api/v1/comment-replies/inbox?tenantId=&workspaceId=&contentId?` | Comment groups/nodes |
| POST | `/api/v1/comment-replies/fetch` | Refresh comments |
| POST | `/api/v1/comment-replies/{id}/send` | Body includes reply text; treat non-`sent` as failure |

**Client rule**: Clear composer / toast success only when `sent === true`.

## RBAC

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/rbac/effective-permissions/{tenantId}/{userId}` | Gate create/edit/publish/reply |

## Isolation

Never omit `workspaceId` for content, media, connections, inbox, or comment-replies once a workspace is active.

## Out of contract

Ads, Brand Brain, Analytics, Team admin, Billing, Mail, Chatbot, WhatsApp hub/templates, Approvals UI, Campaigns, Export, push.
