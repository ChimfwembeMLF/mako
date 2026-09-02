# Data Model: Mobile UI Parity (client-side)

**Feature**: `007-mobile-ui-parity` | **Date**: 2026-08-27

Client-side entities and API-backed shapes. No new database tables.

## DesignTokenSet

| Field | Type | Notes |
|-------|------|-------|
| colors | map | `primary`, `ink`, `canvas`, `canvas-soft`, dark variants |
| fonts | map | `body`, `bodySemi`, `display`, `displaySemi` |
| spacing | map | `xs`–`3xl` |
| rounded | map | `md`, `xl`, `pill` |

**Validation**: All UI components import from `theme.ts` only — no hardcoded hex in screens.

---

## UIComponent (catalog)

| Name | Props (conceptual) | Used on |
|------|-------------------|---------|
| Button | variant, label, loading, disabled | All screens |
| Card | children, onPress, selected | Lists, connections |
| Input | value, placeholder, multiline | Forms, composer |
| Badge | label, tone | Status chips |
| Chip | label, selected, disabled | Filters, calendar toggle |
| PageHeader | title, subtitle, icon, actions | Every route |
| Screen | loading, empty, padded | Tab roots |
| HeroBanner | title, subtitle, CTAs | Home |
| QuickLinkCard | title, description, onPress | Home |
| MessageBubble | body, direction, timestamp, author | Inbox thread |
| Toast | message, tone, duration | Global feedback |
| EmptyState | title, description, action | Zero-data lists |
| Skeleton | lines, height | Loading lists |
| Sheet | visible, onClose, children | Pickers, workspace switch |

---

## NavigationDestination

| Field | Type | Notes |
|-------|------|-------|
| id | string | e.g. `brand-brain` |
| title | string | Display label |
| route | string | Expo path |
| permission | string[]? | RBAC keys; empty = authenticated |
| group | enum | `tab` \| `more` \| `stack` |
| icon | string | SF Symbol / glyph |

**State**: Filtered list derived from `mobile-nav.ts` + `useEffectivePermissions`.

---

## WorkspaceContext (existing, extended)

| Field | Type | Notes |
|-------|------|-------|
| activeWorkspace | object | id, name, tenantId, role |
| tenantId | string | Persisted SecureStore |
| setActiveWorkspace | fn | Updates storage + invalidates queries |

**Rule**: Changing workspace invalidates all tenant/workspace-scoped React Query keys.

---

## BrandProfile (API: `/api/v1/brand-profiles/mine`)

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | |
| tenantId | uuid | |
| companyName | string? | |
| tagline | string? | |
| toneOfVoice | string? | |
| audience | string? | |
| offerings | string? | |
| avoidTopics | string? | |

**Transitions**: view → edit → save (PATCH) | empty → setup prompt

---

## MediaAsset (API: `/api/v1/media`)

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | |
| url | string | |
| type | string | image/video |
| name | string? | |
| createdAt | string? | |

**Relationship**: Attachable to ContentItem via `attachMedia`.

---

## ContentTemplate (API: `/api/v1/templates`)

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | |
| title | string | |
| body | string | Pre-fill content |
| platforms | string[]? | |

---

## Campaign (API: `/api/v1/content-campaigns` or web equivalent)

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | |
| name | string | |
| status | string | draft/active/… |
| workspaceId | uuid | |

---

## AnalyticsSnapshot (API: `/api/v1/analytics/platform-dashboard`)

| Field | Type | Notes |
|-------|------|-------|
| totals | object | impressions, engagement, … |
| byPlatform | array | Platform breakdown |
| period | string | e.g. last 30 days |

**Validation**: Show empty state if API returns null/empty — not fake zeros.

---

## TeamMember (API: tenant members / team endpoint)

| Field | Type | Notes |
|-------|------|-------|
| userId | uuid | |
| email | string | |
| roleName | string | |
| status | string | active/invited |

---

## ApprovalRequest (API: `/api/v1/approval-requests`)

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | |
| status | string | pending/approved/rejected |
| contentId | uuid? | Linked draft |
| requestedAt | string | |

---

## Lead (API: `/api/v1/leads`)

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | |
| name | string? | |
| email | string? | |
| status | string | qualified/unqualified |
| source | string? | |

---

## MailThreadSummary (API: `/api/v1/mail/inbox`)

| Field | Type | Notes |
|-------|------|-------|
| id | string | |
| subject | string? | |
| preview | string? | |
| from | string? | |
| receivedAt | string? | |

---

## AutoReplyRule (API: `/api/v1/auto-reply-rules`)

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | |
| name | string | |
| enabled | boolean | |
| channel | string? | |

---

## ToastMessage (client-only)

| Field | Type | Notes |
|-------|------|-------|
| id | string | |
| message | string | |
| tone | enum | success \| error \| info |
| durationMs | number | default 4000 |

---

## OnboardingState (client-only)

| Field | Type | Notes |
|-------|------|-------|
| dismissed | boolean | AsyncStorage |
| shownAt | string? | First sign-in timestamp |

---

## PermissionGate (extended)

Expand `useEffectivePermissions` keys to mirror web `P.*` used by mobile nav:

- `settings.view`, `settings.brand_brain`
- `team.view`, `approvals.view`
- `chatbot.view` (for future; hide if absent)
- Existing: publish, reply, create, edit

**Rule**: Unknown permission → treat as denied (fail closed).
