# Data Model: Mobile Core Hardening

Client-side / API-facing entities for this feature. No new database tables.

## Draft / Post (`ContentItem`)

| Field | Notes |
|-------|--------|
| id | Content item id |
| title, content | Editable copy — MUST be saved before publish-now |
| platforms | Selected destinations; MUST intersect connected account platforms |
| status | `draft` \| `scheduled` \| `published` \| failed variants |
| scheduledDate, scheduledTime | Cleared on cancel-schedule |
| media[] | Existing attachments `{ id?, url, type? }` — MUST render on edit |

**Transitions**: `scheduled` → `draft` (cancel schedule); draft/scheduled → publish queue via publish-now after save.

## Connected Account

| Field | Notes |
|-------|--------|
| id | Social account id |
| platform | e.g. facebook, instagram, linkedin, youtube, tiktok, twitter, whatsapp |
| accountName / name | Display |
| workspaceId | Isolation |

**Rule**: Publish destination chips only for platforms with ≥1 connected account in active workspace.

## Inbox Conversation

| Field | Notes |
|-------|--------|
| id | `dm:…` or comment-thread / content-scoped id from unified list |
| channel | `dm` \| `post_comment` |
| platform | Network |
| title, preview, lastAt | List UX |
| contentId | Present for post_comment (thread load) |

## Inbox Message / Comment node

| Field | Notes |
|-------|--------|
| id | Message or comment-reply row id |
| body / commentText | Display |
| direction / status | inbound/outbound; reply state |
| created_at | Ordering |

## Reply Outcome

| Field | Notes |
|-------|--------|
| sent | boolean — UI success gate |
| message | Failure reason when `sent` is false |

**Validation**: UI MUST NOT clear composer unless `sent === true`.

## Device Session

| Field | Notes |
|-------|--------|
| accessToken / refreshToken | SecureStore |
| Upload path | MUST refresh on 401 like other authed calls |

## Permission set (effective)

| Key used | UI gate |
|----------|---------|
| content.publish | Publish now |
| replies.create | Inbox reply |
| content.create | New draft / save new |
| content.edit | Update existing draft / cancel schedule |

Fail closed when permissions unknown or fetch failed.
