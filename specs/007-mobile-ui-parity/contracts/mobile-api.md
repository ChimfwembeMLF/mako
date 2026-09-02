# Mobile API Client Contract (UI Parity)

Extends `specs/006-mobile-core-hardening/contracts/mobile-api.md`. Base URL: `EXPO_PUBLIC_API_URL`. Live runtime: **api-rust** (Nest `yarn dev` for local dev).

## Auth / session

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/auth/forgot-password` | Body `{ email }` — opaque success message (no account enumeration) |
| POST | `/api/v1/auth/login` | Unchanged |
| POST | `/api/v1/auth/register` | Unchanged |
| GET | `/api/v1/auth/me` | Profile + tenant |

All authenticated calls: 401 → refresh once → retry; else sign out.

## Workspaces / shell

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/workspaces?tenantId=` | Workspace switcher list |

## Brand Brain (P2)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/brand-profiles/mine?tenantId=` | Load workspace/tenant brand profile |
| PATCH | `/api/v1/brand-profiles/{id}` | Save permitted fields |

Scrape/parse document endpoints: **out of mobile v1** (web-only heavy flows).

## Media library (P2)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/media?tenantId=&workspaceId=` | Paginated library list |
| POST | `/api/v1/media/upload` | Device upload (existing) |
| POST | `/api/v1/content-items/{id}/media` | Attach library or uploaded asset |

## Templates (P2)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/templates?tenantId=&workspaceId=` | List templates |
| GET | `/api/v1/templates/{id}?tenantId=` | Template detail for apply-to-draft |

Create/edit/delete templates: **out of mobile v1** (read + apply only).

## Campaigns (P2)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/content-campaigns?tenantId=&workspaceId=` | List campaigns |
| GET | `/api/v1/content-campaigns/{id}` | Campaign detail (read-only mobile v1) |

## Analytics snapshot (P2)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/analytics/platform-dashboard?tenantId=&workspaceId=` | High-level metrics cards |

Full AI report / insights drill-down: **deferred**.

## Settings (P2)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/auth/me` | Account summary |
| GET | `/api/v1/tenants/mine` or tenant theme endpoint if exposed | Theme preference (dark mode) |

Billing checkout endpoints: **out of scope**.

## Team (P3)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/tenant-members?tenantId=` or web-equivalent team list | Roster read |

Invite/edit roles: **web-only v1** unless already one-tap on web.

## Approvals (P3)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/approval-requests?tenantId=&workspaceId=` | Pending/history list |
| PATCH | `/api/v1/approval-requests/{id}` | Approve/reject when permitted |

## Leads (P3)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/leads?tenantId=` | List |
| GET | `/api/v1/leads/{id}` | Detail read |

## Mail (P3)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/mail/gmail/status` | Connection status |
| GET | `/api/v1/mail/inbox?tenantId=&…` | Thread summary list |

Reply/compose: **optional**; read-first acceptable per spec.

## WhatsApp hub (P3)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/whatsapp/...` status/summary endpoints as web dashboard uses | Connection health + links |

Template CRUD / flow editor: **out of scope** (hub status only).

## Auto-reply rules (P3)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/auto-reply-rules?tenantId=` | List rules |
| PATCH | `/api/v1/auto-reply-rules/{id}` | Toggle enabled when permitted |

## Unchanged from 006 (core social)

Content items, publish, connections OAuth, inbox, comment-replies, RBAC effective-permissions — see 006 contract.

## Isolation

Every request above MUST include active `tenantId` and, where applicable, `workspaceId`.

## Rust gap handling

If any path returns 404 on `api-rust` during QA:

1. Log in `api/docs/RUST_MIGRATION.md`
2. Port minimal Nest-equivalent handler OR mark quickstart scenario as Nest-dev-only until closed

## Out of contract (FR-016)

Ads, chatbot/knowledge authoring, billing checkout, super-admin backoffice, export jobs, push notifications, drag-and-drop calendar reschedule.
