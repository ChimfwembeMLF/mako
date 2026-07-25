# Data Model: Social Media Dashboard

**Feature**: `003-social-dashboard` | **Date**: 2026-07-24

## Overview

MVP introduces **no new database tables**. The “model” is a client-side product-shell concept plus reuse of existing tenant/workspace-scoped entities.

## Client concepts

### ProductShell

| Field | Type | Notes |
|-------|------|--------|
| mode | `'main' \| 'social'` | Derived from route / path list |
| homePath | string | `/dashboard` or `/social` |
| navGroups | NavGroup[] | Full `NAV_GROUPS` vs `SOCIAL_NAV_GROUPS` |

### SocialOverview (composed UI state)

| Field | Source | Notes |
|-------|--------|--------|
| workspaceId | `useWorkspace` | Required |
| connections | existing social accounts API | Connected platforms |
| upcomingPosts | scheduler / content APIs | Next scheduled items |
| inboxHighlight | replies API if available | Unread / recent |
| platformWidgets | `PlatformDashboard` | Optional embed |

## Existing entities (unchanged)

- **Tenant** / **TenantMember** / **Role** / **Permission** — RBAC
- **Workspace** — brand scope for social data
- **SocialAccount** — OAuth connections
- **ContentItem** / publications / schedule fields
- **Social inbox** messages/comments (existing modules)

## Validation rules

- Shell mode MUST NOT change tenancy; all fetches keep `tenantId` / `workspaceId` headers/query as today.
- Social home MUST handle empty workspace (prompt to create/select workspace) like other pages.
- No schema migrations for this feature.

## State transitions

```text
[Main shell] --navigate /social--> [Social shell]
[Social shell] --navigate /dashboard--> [Main shell]
[Social shell] --open /content--> [Social shell + Content page]
[Main shell] --open /leads--> [Main shell + Leads]
```

## Future (out of scope)

- `social_staff_role` or product-area permission packs
- Persisted “default home shell” per user preference
- Server-side social overview DTO
