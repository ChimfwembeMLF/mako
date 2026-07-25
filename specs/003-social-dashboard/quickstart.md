# Quickstart: Social Media Dashboard

**Feature**: `003-social-dashboard`

## Prerequisites

- Local: `yarn dev` (API) + `yarn dev:ui` (client), or production client against live API
- User with content and/or replies permissions in a tenant with at least one workspace

## Validation scenarios

### 1. Two distinct homes

1. Sign in → open `/dashboard` → confirm main overview loads.
2. Open Social entry (card or nav) → land on `/social`.
3. Confirm social overview (connections / upcoming / inbox widgets as implemented).
4. Use “Main app” control → back to `/dashboard`.

**Expect**: Two homes; no logout; workspace preserved.

### 2. Social-scoped nav

1. From `/social`, open Apps menu.
2. Confirm social items present (Content, Scheduler, Connections, Social Inbox, …).
3. Confirm Leads / Mail / Chatbot are **not** in primary Social Apps list.
4. Open Content → page works; chrome still Social.
5. Switch to `/dashboard` → Apps shows full groups including Leads/Mail/Chatbot.

### 3. Workspace scope

1. On `/social`, note upcoming posts for workspace A.
2. Switch workspace to B.
3. Confirm overview/lists update for B.

### 4. Permissions

1. As Viewer (or user without social perms), hit `/social`.
2. Expect redirect/deny consistent with app patterns.
3. As Publisher/Creator, `/social` allowed.

### 5. Regression

Smoke: `/scheduler`, `/replies`, `/publisher`, `/team`, `/settings` still load.

## Related

- [contracts/ui-shells.md](./contracts/ui-shells.md)
- [data-model.md](./data-model.md)
- [research.md](./research.md)
