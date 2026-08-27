# Phase 1: Data Model — Mobile Core Features

Client-side models mirroring `api-rust` responses. No new database tables.

## 1. UserSession (existing — harden)

| Field | Type | Notes |
|-------|------|-------|
| accessToken | string | SecureStore |
| refreshToken | string \| null | SecureStore |
| userId | string | From JWT `sub` |
| expiresAt | number | ms epoch |

**Rules**: Cleared on sign-out; refresh on boot if near expiry; public auth calls must not clear session on 401.

## 2. WorkspaceContext (existing — extend)

| Field | Type | Notes |
|-------|------|-------|
| id | string | Active workspace UUID |
| name | string | Display |
| role | string | Best-effort; default `member` if API omits |
| tenantId | string | Required for scoped fetches |

**Rules**: All feature fetches include `tenantId` + `workspaceId`. Invalid stored id cleared when missing from list.

## 3. ContentItem

| Field | Type | Notes |
|-------|------|-------|
| id | string | UUID |
| tenantId | string | |
| workspaceId | string | |
| title | string \| null | |
| body / content | string | Primary copy |
| status | string | `draft` \| `scheduled` \| `published` \| `failed` \| … |
| platforms | string[] | Destinations |
| scheduledAt | string \| null | ISO |
| publishedAt | string \| null | ISO |
| media | MediaRef[] | Optional |

**Transitions**: draft → scheduled → published; draft → published; any → failed (per destination).

**Validation**: Non-empty body or media before publish; at least one platform; workspace must match active.

## 4. MediaRef

| Field | Type | Notes |
|-------|------|-------|
| id / assetId | string \| null | After upload |
| url | string | |
| type | string | image/video |

## 5. ConnectedAccount (SocialAccount)

| Field | Type | Notes |
|-------|------|-------|
| id | string | |
| platform | string | facebook, instagram, linkedin, … |
| accountName | string | Display |
| connected | boolean | |
| workspaceId | string | |

**Rules**: List/disconnect scoped to tenant+workspace; OAuth finalize stores server-side tokens (not in mobile SecureStore).

## 6. InboxConversation / InboxMessage

| Field | Type | Notes |
|-------|------|-------|
| id | string | Conversation id |
| channel | string | post_comment, dm, … |
| platform | string | |
| preview | string | |
| messages[] | InboxMessage | id, body, direction, createdAt |

**Rules**: Reply requires non-empty message; workspace scope mandatory.

## Relationships

```text
UserSession → Tenant (via login/me)
Tenant → Workspace* → ContentItem*
Workspace → ConnectedAccount*
Workspace → InboxConversation*
ContentItem → MediaRef*
```
