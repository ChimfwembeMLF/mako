# SocialOS — Implementation Plan v2
> **Stack:** NestJS · PostgreSQL (Supabase) · TypeScript  
> **Version:** 2.0 · Corrected Module Boundaries & Full File Manifest

---

## Table of Contents

1. [Corrected Module Map](#1-corrected-module-map)
2. [Phase 1 — Auth, Tenancy & RBAC](#2-phase-1--auth-tenancy--rbac-weeks-13)
3. [Phase 2 — Brand & Content](#3-phase-2--brand--content-weeks-47)
4. [Phase 3 — Social & Automation](#4-phase-3--social--automation-weeks-89)
5. [Phase 4 — Leads, WhatsApp & Notifications](#5-phase-4--leads-whatsapp--notifications-weeks-1011)
6. [Phase 5 — Payments & PawaPay](#6-phase-5--payments--pawapay-weeks-1214)
7. [Phase 6 — Backoffice, Audit & Cron](#7-phase-6--backoffice-audit--cron-weeks-1516)
8. [Phase 7 — Hardening & Delivery](#8-phase-7--hardening--delivery-weeks-1718)
9. [Database Migration Order](#9-database-migration-order)
10. [Open Questions](#10-open-questions)

---

## 1. Corrected Module Map

### Rule: One module owns its tables. Cross-module reads go through the owning module's service, never direct DB calls.

> **Key correction from v1:** Roles, permissions, and all RBAC tables (`roles`, `permissions`, `role_permissions`, `user_permissions`) live inside the **Auth module**. They are authorization concerns, not standalone entities.

| # | Module | Tables Owned | Location |
|---|---|---|---|
| 1 | **Auth** | `roles` · `permissions` · `role_permissions` · `user_permissions` | `src/modules/auth/` |
| 2 | **Tenants** | `tenants` · `tenant_members` · `workspaces` · `profiles` | `src/modules/tenants/` |
| 3 | **Brand** | `brand_profiles` | `src/modules/brand/` |
| 4 | **Content** | `content_items` · `media_assets` | `src/modules/content/` |
| 5 | **Social** | `social_accounts` · `auto_reply_rules` · `comment_replies` | `src/modules/social/` |
| 6 | **Leads** | `lead_sources` · `leads` | `src/modules/leads/` |
| 7 | **Payments** | `deposits` · `payment_failures` · `payouts` · `refunds` · `payment_statements` · `wallet_snapshots` | `src/modules/payments/` |
| 8 | **Approvals** | `approval_workflows` · `approval_requests` | `src/modules/approvals/` |
| 9 | **WhatsApp** | `whatsapp_contacts` | `src/modules/whatsapp/` |
| 10 | **Notifications** | _(no table — service only)_ | `src/modules/notifications/` |
| 11 | **Audit** | `audit_logs` | `src/modules/audit/` |
| 12 | **AI Usage** | `ai_usage` | `src/modules/ai-usage/` |
| 13 | **Cron** | _(no table — orchestrator only)_ | `src/modules/cron/` |
| 14 | **Backoffice** | _(read-only cross-module views)_ | `src/modules/backoffice/` |

### Shared / Common Layer

```
src/common/
  decorators/
    current-tenant.decorator.ts   # extracts tenant_id from JWT
    current-user.decorator.ts     # extracts user from request
    roles.decorator.ts            # @Roles(Role.ADMIN)
    permissions.decorator.ts      # @RequirePermissions('content:publish')
  dto/
    api-response.dto.ts           # ApiResponseDto<T> wrapper
    pagination.dto.ts             # PageDto, PageOptionsDto
    uuid-param.dto.ts             # validates :id route params
  filters/
    http-exception.filter.ts      # global structured error responses
  interceptors/
    audit.interceptor.ts          # auto-emits audit_logs on mutations
    response.interceptor.ts       # wraps all responses in ApiResponseDto
  pipes/
    validation.pipe.ts            # global class-validator pipe
  types/
    role.enum.ts                  # USER | ADMIN | SUPER_ADMIN | OWNER
    permission-key.enum.ts        # all permission string literals
```

---

## 2. Phase 1 — Auth, Tenancy & RBAC (Weeks 1–3)

### What gets built
Authentication, session management, all guards, RBAC (roles + permissions), tenant/workspace/member management, and user profiles. Everything else depends on this phase being complete and correct.

---

### 2.1 Auth Module — `src/modules/auth/`

#### Owns
- `roles` table
- `permissions` table
- `role_permissions` table
- `user_permissions` table

#### Why RBAC lives here
Roles and permissions exist solely to answer the question _"is this user allowed to do this?"_ — which is a function of authentication/authorization, not a domain concept. Guards are declared here and imported everywhere else.

#### Full file list

```
src/modules/auth/
  auth.module.ts
  auth.controller.ts
  auth.service.ts

  # RBAC sub-services (registered in AuthModule providers)
  rbac/
    rbac.service.ts               # evaluates role + user_permissions, expiry checks
    roles.service.ts              # CRUD for roles table
    permissions.service.ts        # read-only registry of permissions table
    rbac.controller.ts            # /auth/roles and /auth/permissions endpoints

  # Guards (exported from AuthModule for use by every other module)
  guards/
    jwt-auth.guard.ts             # validates Supabase JWT; attaches user to request
    roles.guard.ts                # reads @Roles() decorator; calls rbac.service
    tenant.guard.ts               # confirms user is a member of requested tenant_id
    owner.guard.ts                # confirms profiles.is_system_admin = true
    usage-gate.guard.ts           # checks ai_usage against plan limit (calls AiUsageService)
    webhook-secret.guard.ts       # HMAC-SHA256 verify for lead webhooks
    pawapay-signature.guard.ts    # RFC-9421 signature verify for PawaPay callbacks

  # Strategies
  strategies/
    jwt.strategy.ts               # Passport JWT strategy; decodes Supabase JWT

  dto/
    login.dto.ts                  # { access_token: string }
    refresh-token.dto.ts          # { refresh_token: string }
    create-role.dto.ts            # { name, description, permission_keys[] }
    update-role.dto.ts
    grant-permission.dto.ts       # { user_id, permission_key, effect, valid_until?, reason? }
    role-response.dto.ts
    permission-response.dto.ts

  entities/
    role.entity.ts                # maps to roles table
    permission.entity.ts          # maps to permissions table
    role-permission.entity.ts     # maps to role_permissions table
    user-permission.entity.ts     # maps to user_permissions table
```

#### Endpoints — `/auth` and `/auth/roles` and `/auth/permissions`

| Method | Path | Guard | Description |
|---|---|---|---|
| POST | `/auth/login` | Public | Exchange Supabase JWT → platform session. Returns `access_token` + `refresh_token`. |
| POST | `/auth/refresh` | Public | Rotate session using `refresh_token`. |
| POST | `/auth/logout` | JwtAuth | Invalidate refresh token. |
| GET | `/auth/me` | JwtAuth | Returns calling user's profile + tenant memberships + resolved permissions. |
| GET | `/auth/roles` | JwtAuth + Tenant + Admin | List all roles for the requesting tenant. |
| POST | `/auth/roles` | JwtAuth + Tenant + SuperAdmin | Create a custom role with selected permissions. |
| GET | `/auth/roles/:id` | JwtAuth + Tenant + Admin | Get role detail with assigned permissions. |
| PATCH | `/auth/roles/:id` | JwtAuth + Tenant + SuperAdmin | Update role name or reassign permissions. |
| DELETE | `/auth/roles/:id` | JwtAuth + Tenant + SuperAdmin | Delete custom role. Blocked if assigned to any member. |
| GET | `/auth/permissions` | JwtAuth + Tenant + Admin | List all available platform permissions grouped by module. |
| POST | `/auth/user-permissions` | JwtAuth + Tenant + Admin | Grant or deny a specific permission to a user (override). |
| GET | `/auth/user-permissions/:userId` | JwtAuth + Tenant + Admin | List all permission overrides for a specific user. |
| DELETE | `/auth/user-permissions/:id` | JwtAuth + Tenant + Admin | Remove a user permission override. |

#### Permission Keys Registry (seeded into `permissions` table at migration)

```
# Content
content:view          content:create        content:update
content:delete        content:publish       content:schedule
content:generate_ai   content:repurpose_ai

# Media
media:upload          media:delete

# Brand
brand:view            brand:create          brand:update
brand:delete          brand:parse_doc       brand:scrape_web

# Social
social:connect        social:disconnect     social:view_comments
social:reply          social:manage_rules

# Leads
leads:view            leads:create          leads:update
leads:delete          leads:webhook_config  leads:ai_reply

# Payments
payments:view         payments:initiate_deposit   payments:manage_payouts
payments:manage_refunds payments:view_wallet

# WhatsApp
whatsapp:view         whatsapp:manage       whatsapp:broadcast

# Approvals
approvals:view        approvals:approve     approvals:configure

# Team
team:view             team:invite           team:manage_roles
team:remove_member

# Backoffice (system admin only — not tenant-scoped)
backoffice:view       backoffice:manage_tenants
backoffice:view_revenue backoffice:manage_payments
```

#### Default Roles (seeded at migration, `is_system = true`)

| Role Name | Assigned Permissions |
|---|---|
| `viewer` | `*.view` permissions only |
| `editor` | `viewer` + `content:create/update/schedule`, `brand:view`, `media:upload`, `leads:view/update`, `social:view_comments` |
| `manager` | `editor` + `content:publish/delete`, `brand:create/update/parse_doc/scrape_web`, `leads:create/delete/ai_reply`, `social:connect/reply/manage_rules`, `payments:view`, `approvals:view/approve`, `team:view/invite` |
| `admin` | `manager` + `payments:initiate_deposit`, `whatsapp:manage/broadcast`, `approvals:configure`, `team:manage_roles/remove_member` |
| `super_admin` | All permissions except `backoffice:*` |

---

### 2.2 Tenants Module — `src/modules/tenants/`

#### Owns
- `tenants` table
- `tenant_members` table
- `workspaces` table
- `profiles` table

#### File list

```
src/modules/tenants/
  tenants.module.ts
  tenants.controller.ts
  tenants.service.ts

  workspaces/
    workspaces.controller.ts
    workspaces.service.ts

  members/
    members.controller.ts
    members.service.ts
    invite.service.ts           # generates signed JWT invite, calls NotificationsService

  profiles/
    profiles.controller.ts
    profiles.service.ts

  dto/
    create-tenant.dto.ts        # { name, slug }
    update-tenant.dto.ts        # { name?, slug?, logo_url? }
    create-workspace.dto.ts     # { name, slug, logo_url? }
    update-workspace.dto.ts
    invite-member.dto.ts        # { email, role_id }
    accept-invite.dto.ts        # { token }
    update-member.dto.ts        # { role_id?, is_active? }
    update-profile.dto.ts       # { display_name?, full_name?, avatar_url? }
    tenant-response.dto.ts
    workspace-response.dto.ts
    member-response.dto.ts
    profile-response.dto.ts

  entities/
    tenant.entity.ts
    workspace.entity.ts
    tenant-member.entity.ts
    profile.entity.ts
```

#### Endpoints

| Method | Path | Guard | Description |
|---|---|---|---|
| POST | `/tenants` | JwtAuth | Create tenant. Caller becomes owner via `tenant_members` with `super_admin` role. |
| GET | `/tenants/:tenantId` | JwtAuth + Tenant + Manager | Get tenant detail. |
| PATCH | `/tenants/:tenantId` | JwtAuth + Tenant + Admin | Update name, slug, or logo. |
| DELETE | `/tenants/:tenantId` | JwtAuth + Tenant + SuperAdmin | Soft-delete tenant. |
| GET | `/tenants/:tenantId/workspaces` | JwtAuth + Tenant + Viewer | List workspaces. |
| POST | `/tenants/:tenantId/workspaces` | JwtAuth + Tenant + Admin | Create workspace. |
| GET | `/tenants/:tenantId/workspaces/:workspaceId` | JwtAuth + Tenant + Viewer | Get workspace. |
| PATCH | `/tenants/:tenantId/workspaces/:workspaceId` | JwtAuth + Tenant + Admin | Update workspace. |
| DELETE | `/tenants/:tenantId/workspaces/:workspaceId` | JwtAuth + Tenant + Admin | Delete workspace. |
| GET | `/tenants/:tenantId/members` | JwtAuth + Tenant + Manager | List members with roles. |
| POST | `/tenants/:tenantId/members/invite` | JwtAuth + Tenant + Admin | Send signed email invitation. |
| POST | `/tenants/:tenantId/members/accept` | JwtAuth | Accept invitation token and join. |
| PATCH | `/tenants/:tenantId/members/:userId` | JwtAuth + Tenant + Admin | Change member role or active status. |
| DELETE | `/tenants/:tenantId/members/:userId` | JwtAuth + Tenant + Admin | Remove member. |
| GET | `/tenants/:tenantId/profile` | JwtAuth + Tenant + Viewer | Get calling user's profile. |
| PATCH | `/tenants/:tenantId/profile` | JwtAuth | Update own profile. |

---

### 2.3 Phase 1 Database Migrations

```
migrations/
  001_auth_extensions.sql         # enable uuid-ossp, pgcrypto
  002_tenants.sql                 # tenants table
  003_profiles.sql                # profiles table
  004_tenant_members.sql          # tenant_members table
  005_workspaces.sql              # workspaces table
  006_permissions.sql             # permissions table + seed all permission keys
  007_roles.sql                   # roles table
  008_role_permissions.sql        # role_permissions table
  009_user_permissions.sql        # user_permissions table + indexes
  010_seed_default_roles.sql      # seed viewer/editor/manager/admin/super_admin
  011_rls_policies.sql            # row-level security on all Phase 1 tables
```

---

## 3. Phase 2 — Brand & Content (Weeks 4–7)

### 3.1 Brand Module — `src/modules/brand/`

#### Owns
- `brand_profiles` table

#### File list

```
src/modules/brand/
  brand.module.ts
  brand.controller.ts
  brand.service.ts

  services/
    parse-document.service.ts   # receives file path, calls LLM, returns structured BrandFields
    scrape-website.service.ts   # Playwright scrape + LLM summarise → BrandFields

  dto/
    create-brand-profile.dto.ts
    update-brand-profile.dto.ts
    parse-document.dto.ts       # { document_url: string, tenant_id: string }
    scrape-website.dto.ts       # { website_url: string }
    brand-profile-response.dto.ts

  entities/
    brand-profile.entity.ts     # maps to brand_profiles
```

#### Endpoints — `/tenants/:tenantId/brand`

| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/tenants/:tenantId/brand` | JwtAuth + Tenant + Viewer | Get brand profile. |
| POST | `/tenants/:tenantId/brand` | JwtAuth + Tenant + `brand:create` | Create brand profile. One per tenant/user. |
| PATCH | `/tenants/:tenantId/brand/:brandId` | JwtAuth + Tenant + `brand:update` | Update brand fields. |
| DELETE | `/tenants/:tenantId/brand/:brandId` | JwtAuth + Tenant + `brand:delete` | Soft-delete (`deleted_at`). |
| POST | `/tenants/:tenantId/brand/parse-document` | JwtAuth + Tenant + `brand:parse_doc` | Upload PDF/DOCX → AI extracts fields. |
| POST | `/tenants/:tenantId/brand/scrape-website` | JwtAuth + Tenant + `brand:scrape_web` | Crawl URL → AI populates brand profile. |

---

### 3.2 Content Module — `src/modules/content/`

#### Owns
- `content_items` table
- `media_assets` table

#### File list

```
src/modules/content/
  content.module.ts
  content.controller.ts
  content.service.ts

  services/
    generate-content.service.ts   # LLM prompt builder + Mistral API call
    repurpose-content.service.ts  # adapts existing content for a new platform
    publish-content.service.ts    # calls platform-specific adapters
    schedule-content.service.ts   # sets scheduled_date/time fields
    media.service.ts              # upload/delete media_assets

  adapters/                       # one file per social platform
    facebook.adapter.ts
    instagram.adapter.ts
    twitter.adapter.ts
    linkedin.adapter.ts

  dto/
    generate-content.dto.ts       # { brand_profile_id, content_type, campaign_theme, platforms[] }
    repurpose-content.dto.ts      # { source_content_id, target_platform }
    create-content.dto.ts
    update-content.dto.ts
    schedule-content.dto.ts       # { scheduled_date, scheduled_time }
    publish-content.dto.ts        # { platforms[] }
    upload-media.dto.ts
    generate-image.dto.ts         # { prompt, style? }
    generate-slideshow.dto.ts     # { slides: { prompt }[] }
    content-item-response.dto.ts
    media-asset-response.dto.ts

  entities/
    content-item.entity.ts        # maps to content_items
    media-asset.entity.ts         # maps to media_assets
```

#### Endpoints — `/tenants/:tenantId/content`

| Method | Path | Guard | Description |
|---|---|---|---|
| POST | `/tenants/:tenantId/content/generate` | JwtAuth + Tenant + `content:generate_ai` + UsageGate | Generate content via LLM. Inserts `content_items` row with `status: draft`. |
| POST | `/tenants/:tenantId/content/generate-image` | JwtAuth + Tenant + `content:generate_ai` + UsageGate | Generate single AI image. Stores URL in `media_assets`. |
| POST | `/tenants/:tenantId/content/generate-slideshow` | JwtAuth + Tenant + `content:generate_ai` + UsageGate | Generate multi-image slideshow. Returns array of `media_assets`. |
| POST | `/tenants/:tenantId/content/repurpose` | JwtAuth + Tenant + `content:repurpose_ai` + UsageGate | Rewrite existing content for a new platform. |
| GET | `/tenants/:tenantId/content` | JwtAuth + Tenant + `content:view` | List with filters: `status`, `platforms[]`, `workspace_id`, `scheduled_date_from/to`. |
| GET | `/tenants/:tenantId/content/:contentId` | JwtAuth + Tenant + `content:view` | Get single item with media assets. |
| PATCH | `/tenants/:tenantId/content/:contentId` | JwtAuth + Tenant + `content:update` | Update title, body, platforms, campaign_theme. |
| DELETE | `/tenants/:tenantId/content/:contentId` | JwtAuth + Tenant + `content:delete` | Soft-delete (`deleted_at`). |
| POST | `/tenants/:tenantId/content/:contentId/publish` | JwtAuth + Tenant + `content:publish` + Approval? | Publish immediately. Blocked by approval workflow if configured. |
| POST | `/tenants/:tenantId/content/:contentId/schedule` | JwtAuth + Tenant + `content:schedule` | Set schedule. Changes `status` to `scheduled`. |
| POST | `/tenants/:tenantId/content/:contentId/media` | JwtAuth + Tenant + `media:upload` | Upload media asset(s) to content item. |
| DELETE | `/tenants/:tenantId/content/media/:assetId` | JwtAuth + Tenant + `media:delete` | Remove media asset. |

---

### 3.3 Phase 2 Migrations

```
migrations/
  012_brand_profiles.sql
  013_content_items.sql
  014_media_assets.sql
  015_rls_brand_content.sql
```

---

## 4. Phase 3 — Social & Automation (Weeks 8–9)

### 4.1 Social Module — `src/modules/social/`

#### Owns
- `social_accounts` table
- `auto_reply_rules` table
- `comment_replies` table

#### File list

```
src/modules/social/
  social.module.ts
  social.controller.ts
  social.service.ts

  services/
    facebook-token.service.ts     # exchange short-lived → long-lived FB token
    instagram-token.service.ts    # exchange IG Basic Display token
    comment-fetch.service.ts      # fetch comments from platform APIs
    auto-reply.service.ts         # evaluates rules, generates/sends replies

  dto/
    connect-facebook.dto.ts       # { fb_token: string }
    connect-instagram.dto.ts      # { ig_token: string }
    create-auto-reply-rule.dto.ts # { platform, name, trigger_keywords[], trigger_sentiment?, response_template?, ai_generate }
    update-auto-reply-rule.dto.ts
    trigger-reply.dto.ts          # { comment_id, platform, post_id }
    social-account-response.dto.ts
    auto-reply-rule-response.dto.ts
    comment-reply-response.dto.ts

  entities/
    social-account.entity.ts
    auto-reply-rule.entity.ts
    comment-reply.entity.ts
```

#### Endpoints — `/tenants/:tenantId/social`

| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/tenants/:tenantId/social/accounts` | JwtAuth + Tenant + `social:view_comments` | List connected accounts. Tokens excluded from response. |
| POST | `/tenants/:tenantId/social/accounts/connect/facebook` | JwtAuth + Tenant + `social:connect` | Exchange + store long-lived FB token. |
| POST | `/tenants/:tenantId/social/accounts/connect/instagram` | JwtAuth + Tenant + `social:connect` | Exchange + store IG token. |
| DELETE | `/tenants/:tenantId/social/accounts/:accountId` | JwtAuth + Tenant + `social:disconnect` | Disconnect account (soft-delete). |
| GET | `/tenants/:tenantId/social/comments/:postId` | JwtAuth + Tenant + `social:view_comments` | Fetch recent comments from platform for a post. |
| GET | `/tenants/:tenantId/social/auto-reply/rules` | JwtAuth + Tenant + `social:view_comments` | List auto-reply rules. |
| POST | `/tenants/:tenantId/social/auto-reply/rules` | JwtAuth + Tenant + `social:manage_rules` | Create rule. |
| PATCH | `/tenants/:tenantId/social/auto-reply/rules/:ruleId` | JwtAuth + Tenant + `social:manage_rules` | Update rule. |
| DELETE | `/tenants/:tenantId/social/auto-reply/rules/:ruleId` | JwtAuth + Tenant + `social:manage_rules` | Delete rule (soft-delete). |
| POST | `/tenants/:tenantId/social/auto-reply/trigger` | JwtAuth + Tenant + `social:reply` | Manually trigger a reply to a comment. |
| GET | `/tenants/:tenantId/social/comment-replies` | JwtAuth + Tenant + `social:view_comments` | List reply history. Filters: `status`, `platform`, `rule_id`, date range. |

---

### 4.2 Phase 3 Migrations

```
migrations/
  016_social_accounts.sql
  017_auto_reply_rules.sql
  018_comment_replies.sql
  019_rls_social.sql
```

---

## 5. Phase 4 — Leads, WhatsApp & Notifications (Weeks 10–11)

### 5.1 Leads Module — `src/modules/leads/`

#### Owns
- `lead_sources` table
- `leads` table

#### File list

```
src/modules/leads/
  leads.module.ts
  leads.controller.ts
  leads.service.ts

  services/
    lead-sources.service.ts     # CRUD for lead_sources, generates webhook_secret
    lead-webhook.service.ts     # processes inbound webhook payloads, classifies leads
    lead-reply.service.ts       # AI reply generation, calls NotificationsService for email
    unsubscribe.service.ts      # validates unsubscribe token, sets unsubscribed = true

  dto/
    create-lead-source.dto.ts   # { label }
    update-lead-source.dto.ts
    lead-webhook-payload.dto.ts # { name, email, message, source? }
    update-lead.dto.ts          # { status?, classification?, notes? }
    send-email.dto.ts           # { template_id }
    ai-reply.dto.ts             # { send?: boolean }
    unsubscribe.dto.ts          # { token }
    lead-source-response.dto.ts
    lead-response.dto.ts

  entities/
    lead-source.entity.ts
    lead.entity.ts
```

#### Endpoints

| Method | Path | Guard | Description |
|---|---|---|---|
| POST | `/leads/webhook/:sourceId` | WebhookSecret | Inbound webhook. HMAC-SHA256 verified against `lead_sources.webhook_secret`. |
| POST | `/leads/unsubscribe` | Public | Validates JWT unsubscribe token. Sets `leads.unsubscribed = true`. Single-use. |
| GET | `/tenants/:tenantId/lead-sources` | JwtAuth + Tenant + `leads:webhook_config` | List lead sources. `webhook_secret` excluded from list response. |
| POST | `/tenants/:tenantId/lead-sources` | JwtAuth + Tenant + `leads:webhook_config` | Create source. Returns `webhook_secret` once only. |
| DELETE | `/tenants/:tenantId/lead-sources/:sourceId` | JwtAuth + Tenant + `leads:webhook_config` | Delete source. |
| GET | `/tenants/:tenantId/leads` | JwtAuth + Tenant + `leads:view` | List leads. Filters: `status`, `source`, `classification`, date range. |
| GET | `/tenants/:tenantId/leads/:leadId` | JwtAuth + Tenant + `leads:view` | Get lead detail. |
| PATCH | `/tenants/:tenantId/leads/:leadId` | JwtAuth + Tenant + `leads:update` | Update status, classification, notes. |
| DELETE | `/tenants/:tenantId/leads/:leadId` | JwtAuth + Tenant + `leads:delete` | Soft-delete. |
| POST | `/tenants/:tenantId/leads/:leadId/send-email` | JwtAuth + Tenant + `leads:update` | Send follow-up email via NotificationsService. |
| POST | `/tenants/:tenantId/leads/:leadId/ai-reply` | JwtAuth + Tenant + `leads:ai_reply` + UsageGate | Generate AI reply. Optionally send immediately. |

---

### 5.2 WhatsApp Module — `src/modules/whatsapp/`

#### Owns
- `whatsapp_contacts` table

#### File list

```
src/modules/whatsapp/
  whatsapp.module.ts
  whatsapp.controller.ts
  whatsapp.service.ts

  dto/
    create-contact.dto.ts       # { phone, name, tags[]? }
    update-contact.dto.ts       # { tags[]?, opted_in? }
    broadcast-message.dto.ts    # { message, filter?: { tags[]?, opted_in? } }
    opt-out.dto.ts              # { token }
    contact-response.dto.ts

  entities/
    whatsapp-contact.entity.ts
```

#### Endpoints — `/tenants/:tenantId/whatsapp`

| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/tenants/:tenantId/whatsapp/contacts` | JwtAuth + Tenant + `whatsapp:view` | List contacts. Filters: `opted_in`, `tags[]`. |
| POST | `/tenants/:tenantId/whatsapp/contacts` | JwtAuth + Tenant + `whatsapp:manage` | Add contact. |
| POST | `/tenants/:tenantId/whatsapp/contacts/import` | JwtAuth + Tenant + `whatsapp:manage` | Bulk import from CSV. |
| PATCH | `/tenants/:tenantId/whatsapp/contacts/:contactId` | JwtAuth + Tenant + `whatsapp:manage` | Update tags or opt-in status. |
| DELETE | `/tenants/:tenantId/whatsapp/contacts/:contactId` | JwtAuth + Tenant + `whatsapp:manage` | Remove contact. |
| POST | `/tenants/:tenantId/whatsapp/broadcast` | JwtAuth + Tenant + `whatsapp:broadcast` + Approval? | Send broadcast to filtered contacts. |
| POST | `/whatsapp/opt-out` | Public (token) | Contact-initiated opt-out. Validates token, sets `opted_in = false`. |

---

### 5.3 Notifications Module — `src/modules/notifications/`

No table. Injectable service only. Imported by Leads, Content, Payments, Approvals, Cron.

#### File list

```
src/modules/notifications/
  notifications.module.ts
  notifications.service.ts      # dispatches to adapters based on type

  adapters/
    sendgrid.adapter.ts         # email via SendGrid API
    twilio.adapter.ts           # SMS via Twilio API
    slack.adapter.ts            # Slack webhook

  dto/
    send-notification.dto.ts    # { type: 'email'|'sms'|'slack', to, subject?, body, data? }
    update-preferences.dto.ts   # { email_enabled, sms_enabled, slack_enabled }
    preferences-response.dto.ts

  templates/                    # Handlebars templates for email
    lead-capture.hbs
    invite-member.hbs
    payment-success.hbs
    payment-failed.hbs
    content-approved.hbs
    approval-requested.hbs
```

#### Endpoints — `/notifications`

| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/notifications/preferences` | JwtAuth | Get calling user's notification preferences. |
| PATCH | `/notifications/preferences` | JwtAuth | Update preferences. |

---

### 5.4 Approvals Module — `src/modules/approvals/`

#### Owns
- `approval_workflows` table
- `approval_requests` table

#### File list

```
src/modules/approvals/
  approvals.module.ts
  approvals.controller.ts
  approvals.service.ts

  dto/
    update-workflow.dto.ts      # { is_enabled, approver_role_id }
    create-request.dto.ts       # { action_key, resource_type, resource_id, payload, requester_notes? }
    review-request.dto.ts       # { reviewer_notes? }
    workflow-response.dto.ts
    approval-request-response.dto.ts
```

#### Endpoints — `/tenants/:tenantId/approvals`

| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/tenants/:tenantId/approvals/workflows` | JwtAuth + Tenant + `approvals:view` | List all workflow configs. |
| PATCH | `/tenants/:tenantId/approvals/workflows/:actionKey` | JwtAuth + Tenant + `approvals:configure` | Enable/disable, change approver role. |
| GET | `/tenants/:tenantId/approvals/requests` | JwtAuth + Tenant + `approvals:view` | List requests. Filters: `status`, `action_key`, `requested_by`, date range. |
| GET | `/tenants/:tenantId/approvals/requests/:requestId` | JwtAuth + Tenant + `approvals:view` | Get request detail + payload. |
| POST | `/tenants/:tenantId/approvals/requests/:requestId/approve` | JwtAuth + Tenant + `approvals:approve` (role match) | Approve. Executes action payload. Records `reviewed_by`. |
| POST | `/tenants/:tenantId/approvals/requests/:requestId/reject` | JwtAuth + Tenant + `approvals:approve` (role match) | Reject. Records reason. |

---

### 5.5 Phase 4 Migrations

```
migrations/
  020_lead_sources.sql
  021_leads.sql
  022_whatsapp_contacts.sql
  023_approval_workflows.sql
  024_approval_requests.sql
  025_seed_approval_workflows.sql   # seed default action_keys: content:publish, whatsapp:broadcast, payments:payout
  026_rls_leads_whatsapp_approvals.sql
```

---

## 6. Phase 5 — Payments & PawaPay (Weeks 12–14)

### 6.1 Payments Module — `src/modules/payments/`

#### Owns
- `deposits` table
- `payment_failures` table
- `payouts` table _(new)_
- `refunds` table _(new)_
- `payment_statements` table _(new)_
- `wallet_snapshots` table _(new)_

#### File list

```
src/modules/payments/
  payments.module.ts
  payments.controller.ts
  payments.service.ts

  pawapay/
    pawapay.service.ts              # orchestrator: calls sub-services
    deposit.service.ts              # initiate, check, resend-callback, payment-page
    payout.service.ts               # initiate, bulk, check, cancel, resend-callback
    refund.service.ts               # initiate, check, resend-callback
    wallet.service.ts               # balances, statements
    toolkit.service.ts              # availability, predict-provider
    signing.service.ts              # RFC-9421 request signing (ECDSA P-256)
    signature-verify.service.ts     # verifies inbound callback signatures

  webhooks/
    webhooks.controller.ts          # /payments/webhooks/pawapay/*
    deposit-webhook.handler.ts
    payout-webhook.handler.ts
    refund-webhook.handler.ts
    statement-webhook.handler.ts

  dto/
    initiate-deposit.dto.ts         # { amount, currency, msisdn, correspondent, plan }
    deposit-payment-page.dto.ts     # { amount, currency, plan, return_url }
    initiate-payout.dto.ts          # { amount, currency, msisdn, correspondent, description }
    bulk-payout.dto.ts              # { payouts: InitiatePayoutDto[] }
    initiate-refund.dto.ts          # { deposit_id, amount, description }
    request-statement.dto.ts        # { date_from, date_to }
    predict-provider.dto.ts         # { msisdn }
    deposit-response.dto.ts
    payout-response.dto.ts
    refund-response.dto.ts
    wallet-balance-response.dto.ts
    statement-response.dto.ts
    availability-response.dto.ts

  entities/
    deposit.entity.ts
    payment-failure.entity.ts
    payout.entity.ts
    refund.entity.ts
    payment-statement.entity.ts
    wallet-snapshot.entity.ts
```

#### New Tables (Phase 5 additions)

```sql
-- payouts
Table payouts {
  id uuid [pk, default: `gen_random_uuid()`]
  payout_id text [unique]           -- PawaPay payoutId (UUID, idempotency key)
  tenant_id uuid [ref: > tenants.id]
  recipient_msisdn text
  amount numeric
  currency text
  correspondent text
  status text                        -- ACCEPTED | ENQUEUED | COMPLETED | FAILED
  failure_code text
  failure_message text
  description text
  raw_payload jsonb
  initiated_by uuid [ref: > auth.users.id]
  created_at timestamptz
  updated_at timestamptz
  indexes { (tenant_id, status, created_at) }
}

-- refunds
Table refunds {
  id uuid [pk, default: `gen_random_uuid()`]
  refund_id text [unique]           -- PawaPay refundId (UUID)
  deposit_id text [ref: > deposits.deposit_id]
  tenant_id uuid [ref: > tenants.id]
  amount numeric
  currency text
  refund_type text                   -- full | partial
  status text                        -- ACCEPTED | COMPLETED | FAILED
  failure_code text
  description text
  raw_payload jsonb
  initiated_by uuid [ref: > auth.users.id]
  created_at timestamptz
  updated_at timestamptz
  indexes { deposit_id }
}

-- payment_statements
Table payment_statements {
  id uuid [pk, default: `gen_random_uuid()`]
  statement_id text [unique]
  tenant_id uuid [ref: > tenants.id]
  date_from date
  date_to date
  status text                        -- INITIATED | COMPLETED | FAILED
  download_url text
  requested_by uuid [ref: > auth.users.id]
  created_at timestamptz
  completed_at timestamptz
}

-- wallet_snapshots
Table wallet_snapshots {
  id uuid [pk, default: `gen_random_uuid()`]
  currency text
  correspondent text
  balance numeric
  snapshotted_at timestamptz
  indexes { (currency, snapshotted_at) }
}
```

#### Endpoints — `/tenants/:tenantId/payments` and `/payments/webhooks`

**Deposits**

| Method | Path | Guard | Description |
|---|---|---|---|
| POST | `/tenants/:tenantId/payments/deposits/initiate` | JwtAuth + Tenant + `payments:initiate_deposit` | Initiate PawaPay deposit. Calls `POST /v2/deposits`. Returns `depositId`. |
| POST | `/tenants/:tenantId/payments/deposits/payment-page` | JwtAuth + Tenant + `payments:initiate_deposit` | Initiate via hosted PawaPay Payment Page. Returns `payment_page_url`. |
| GET | `/tenants/:tenantId/payments/deposits/:depositId` | JwtAuth + Tenant + `payments:view` | Check deposit status from PawaPay API. |
| POST | `/tenants/:tenantId/payments/deposits/:depositId/resend-callback` | JwtAuth + Tenant + `payments:view` | Trigger PawaPay to resend callback for a finalised deposit. |

**Payouts**

| Method | Path | Guard | Description |
|---|---|---|---|
| POST | `/tenants/:tenantId/payments/payouts/initiate` | JwtAuth + Tenant + `payments:manage_payouts` + Approval | Initiate PawaPay payout. Calls `POST /v2/payouts`. |
| POST | `/tenants/:tenantId/payments/payouts/bulk` | JwtAuth + Tenant + `payments:manage_payouts` + Approval | Batch payouts. Calls `POST /v2/payouts/bulk`. |
| GET | `/tenants/:tenantId/payments/payouts/:payoutId` | JwtAuth + Tenant + `payments:manage_payouts` | Check payout status from PawaPay. |
| DELETE | `/tenants/:tenantId/payments/payouts/:payoutId` | JwtAuth + Tenant + `payments:manage_payouts` | Cancel enqueued payout. Calls `DELETE /v2/payouts/{payoutId}`. |
| POST | `/tenants/:tenantId/payments/payouts/:payoutId/resend-callback` | JwtAuth + Tenant + `payments:manage_payouts` | Resend payout callback. |

**Refunds**

| Method | Path | Guard | Description |
|---|---|---|---|
| POST | `/tenants/:tenantId/payments/refunds/initiate` | JwtAuth + Tenant + `payments:manage_refunds` + Approval | Initiate full or partial refund. Multiple partial refunds per `depositId` supported. |
| GET | `/tenants/:tenantId/payments/refunds/:refundId` | JwtAuth + Tenant + `payments:manage_refunds` | Check refund status from PawaPay. |
| POST | `/tenants/:tenantId/payments/refunds/:refundId/resend-callback` | JwtAuth + Tenant + `payments:manage_refunds` | Resend refund callback. |

**Wallet & Toolkit**

| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/tenants/:tenantId/payments/wallets` | JwtAuth + Tenant + `payments:view_wallet` | Fetch live wallet balances. Calls `GET /v2/wallets/balances`. |
| POST | `/tenants/:tenantId/payments/statements` | JwtAuth + Tenant + `payments:view_wallet` | Request financial statement. Calls `POST /v2/statements`. |
| GET | `/tenants/:tenantId/payments/statements/:statementId` | JwtAuth + Tenant + `payments:view_wallet` | Check statement status. |
| GET | `/tenants/:tenantId/payments/availability` | JwtAuth + Tenant | Check MNO availability. Calls `GET /v2/availability`. |
| POST | `/tenants/:tenantId/payments/predict-provider` | JwtAuth + Tenant | Detect correspondent from MSISDN. Calls `POST /v2/predict-provider`. |
| GET | `/tenants/:tenantId/payments/history` | JwtAuth + Tenant + `payments:view` | Unified list of deposits + payouts + refunds with pagination. |

**Inbound Webhooks (no tenant in path — PawaPay posts directly)**

| Method | Path | Guard | Description |
|---|---|---|---|
| POST | `/payments/webhooks/pawapay/deposit` | PawapaySignature | Deposit status update. Verifies RFC-9421 signature. Updates `deposits` table. |
| POST | `/payments/webhooks/pawapay/payout` | PawapaySignature | Payout status update. Updates `payouts` table. |
| POST | `/payments/webhooks/pawapay/refund` | PawapaySignature | Refund status update. Updates `refunds` table. |
| POST | `/payments/webhooks/pawapay/statement` | PawapaySignature | Statement ready callback. Updates `payment_statements.download_url`. |
| POST | `/payments/webhooks/paystack` | — | Returns `410 Gone`. Deprecated. |

#### PawaPay RFC-9421 Signing (`signing.service.ts`)

```typescript
// Implemented in signing.service.ts
// Environment variables required:
//   PAWAPAY_API_TOKEN       - Bearer token for PawaPay API
//   PAWAPAY_PRIVATE_KEY     - PEM-encoded ECDSA P-256 private key
//   PAWAPAY_PUBLIC_KEY_ID   - Key ID registered in PawaPay Dashboard

// Per outgoing request:
// 1. Hash body: SHA-512 → base64 → Content-Digest header
// 2. Build signature base from: @method, @authority, @path,
//    Signature-Date, Content-Digest, Content-Type
// 3. Sign with ECDSA P-256 private key
// 4. Attach: Signature, Signature-Input headers

// Per incoming callback:
// 1. Fetch PawaPay public key: GET /v2/public-keys (cache 24h)
// 2. Extract Signature + Signature-Input from headers
// 3. Verify against cached public key → reject 401 if invalid
```

---

### 6.2 Phase 5 Migrations

```
migrations/
  027_payouts.sql
  028_refunds.sql
  029_payment_statements.sql
  030_wallet_snapshots.sql
  031_rls_payments.sql
```

---

## 7. Phase 6 — Backoffice, Audit & Cron (Weeks 15–16)

### 7.1 Audit Module — `src/modules/audit/`

#### Owns
- `audit_logs` table

Writes are handled automatically by `AuditInterceptor` in `src/common/interceptors/audit.interceptor.ts`. The module only exposes query endpoints.

#### File list

```
src/modules/audit/
  audit.module.ts
  audit.controller.ts
  audit.service.ts

  dto/
    audit-log-query.dto.ts      # { tenant_id?, user_id?, resource_type?, action?, date_from?, date_to?, q? }
    audit-log-response.dto.ts

  entities/
    audit-log.entity.ts
```

#### Endpoints

| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/tenants/:tenantId/audit-logs` | JwtAuth + Tenant + SuperAdmin | Query audit logs for tenant. Full-text search on `action` + `resource_type`. |

---

### 7.2 AI Usage Module — `src/modules/ai-usage/`

#### Owns
- `ai_usage` table

#### File list

```
src/modules/ai-usage/
  ai-usage.module.ts
  ai-usage.service.ts           # checkAndIncrement(tenantId, functionName, tokens)
                                # exported and used by UsageGateGuard in Auth module

  dto/
    ai-usage-query.dto.ts       # { tenant_id?, function_name?, date_from?, date_to? }
    ai-usage-response.dto.ts

  entities/
    ai-usage.entity.ts
```

No public HTTP endpoints. Used internally via `AiUsageService`. Backoffice reads it directly.

---

### 7.3 Backoffice Module — `src/modules/backoffice/`

No tables owned. Read-only cross-module views via injected services. All routes require `OwnerGuard`.

#### File list

```
src/modules/backoffice/
  backoffice.module.ts
  backoffice.controller.ts
  backoffice.service.ts

  dto/
    tenant-overview-response.dto.ts
    revenue-summary-response.dto.ts
    subscription-response.dto.ts
    ai-usage-summary-response.dto.ts
    platform-health-response.dto.ts
```

#### Endpoints — `/backoffice`

| Method | Path | Guard | Description |
|---|---|---|---|
| GET | `/backoffice/tenants` | OwnerGuard | All tenants: name, slug, owner, plan, member count, MRR, status. Pagination + search. |
| GET | `/backoffice/tenants/:tenantId` | OwnerGuard | Full tenant drill-down: workspaces, members, recent deposits, content stats. |
| PATCH | `/backoffice/tenants/:tenantId` | OwnerGuard | Update plan tier, status (`active`/`suspended`/`cancelled`), or flags. |
| DELETE | `/backoffice/tenants/:tenantId` | OwnerGuard | Force-deactivate tenant. Cascade soft-delete all resources. |
| GET | `/backoffice/revenue` | OwnerGuard | Platform MRR/ARR, deposits by plan/period/currency/tenant. Monthly trend. |
| GET | `/backoffice/deposits` | OwnerGuard | All deposits across all tenants. Filters: status, plan, provider, date range. |
| GET | `/backoffice/subscriptions` | OwnerGuard | Plan distribution, active/trial/churned counts, month-on-month. |
| GET | `/backoffice/ai-usage` | OwnerGuard | Token consumption by tenant, function, period. Cost estimates. |
| GET | `/backoffice/audit-logs` | OwnerGuard | Platform-wide audit log. Search across all tenants. |
| POST | `/backoffice/notify` | OwnerGuard | Broadcast notification to all tenants or a specific tenant. |
| GET | `/backoffice/health` | OwnerGuard | Cron job status, BullMQ queue depths, error rate, uptime. |
| GET | `/backoffice/pawapay/wallets` | OwnerGuard | Live PawaPay wallet balances for platform master account. |
| POST | `/backoffice/pawapay/payout` | OwnerGuard | Initiate payout from platform wallet. |

---

### 7.4 Cron Module — `src/modules/cron/`

No tables. Orchestrates existing services on a schedule.

#### File list

```
src/modules/cron/
  cron.module.ts

  jobs/
    auto-publish.job.ts               # @Cron('*/5 * * * *')
    check-pawapay-deposits.job.ts     # @Cron('*/10 * * * *')
    daily-content-workflow.job.ts     # @Cron('0 8 * * *') — per tenant timezone
    cleanup-expired-permissions.job.ts# @Cron('0 2 * * *')
    ai-usage-reset.job.ts             # @Cron('0 0 1 * *')
    wallet-snapshot.job.ts            # @Cron('0 */6 * * *') — every 6h
```

#### Job Details

| Job | Schedule | Logic |
|---|---|---|
| `auto-publish` | Every 5 min | Query `content_items` WHERE `status = 'scheduled'` AND `scheduled_date/time <= NOW()`. Call `PublishContentService.publish()`. On success → `status = 'published'`, set `published_at`. On failure → store `publish_failed_reason`, keep `status = 'scheduled'` for retry. Fire notification. |
| `check-pawapay-deposits` | Every 10 min | Query `deposits` WHERE `status = 'ACCEPTED'` AND `created_at < NOW() - interval '5 min'`. Call PawaPay `GET /v2/deposits/{depositId}`. Update status. Fire notification on `COMPLETED`. Log failure to `payment_failures`. |
| `daily-content-workflow` | Daily 08:00 | Per tenant: call `GenerateContentService`. If `auto_publish_enabled`, call `PublishContentService`. Write to `daily_workflow_log`. |
| `cleanup-expired-permissions` | Daily 02:00 | DELETE FROM `user_permissions` WHERE `valid_until < NOW()`. |
| `ai-usage-reset` | 1st of month 00:00 | Reset monthly counters in `ai_usage` per plan cycle. |
| `wallet-snapshot` | Every 6 hours | Call `GET /v2/wallets/balances`, insert row into `wallet_snapshots`. |

---

### 7.5 Phase 6 Migrations

```
migrations/
  032_audit_logs.sql
  033_ai_usage.sql
  034_rls_audit_ai.sql
```

---

## 8. Phase 7 — Hardening & Delivery (Weeks 17–18)

### 8.1 Security Checklist

- [ ] All endpoints have correct guard composition — no route left unguarded
- [ ] Every DB query has `tenant_id` in WHERE clause (even with RLS)
- [ ] `social_accounts.credentials` column encrypted at rest (pgcrypto or app-level AES-256)
- [ ] `lead_sources.webhook_secret` stored as bcrypt hash; compared via timing-safe comparison
- [ ] Unsubscribe tokens are single-use: mark as used on first valid redemption
- [ ] Audit logs: no UPDATE or DELETE permitted — RLS blocks non-service-role writes
- [ ] PawaPay public keys cached and refreshed on verification failure
- [ ] PawaPay callback IPs whitelisted in infrastructure firewall

### 8.2 Swagger Completion

- [ ] Every endpoint has `@ApiOperation({ summary })` and `@ApiResponse` for 200, 400, 401, 403, 404, 422, 500
- [ ] Every DTO has `@ApiProperty({ example })` on all fields
- [ ] Backoffice routes are tagged `Backoffice` and hidden from tenant-facing API spec
- [ ] Webhook endpoints tagged `Webhooks — Internal` with a note not to call from frontend

### 8.3 Testing Targets

| Scope | Tool | Target |
|---|---|---|
| Unit tests — all services | Jest | ≥ 80% line coverage |
| E2E — auth + tenant isolation | Jest + Supertest | Full happy path + 401/403 cases |
| E2E — payment flows | Jest + Supertest | Deposit → webhook → status update |
| E2E — content generate → publish | Jest + Supertest | Generate → approve → publish |
| PawaPay signature | Jest | Valid sig passes, tampered sig rejects |
| HMAC webhook guard | Jest | Valid secret passes, wrong secret rejects |

### 8.4 CI/CD Pipeline (`.github/workflows/ci.yml`)

```yaml
jobs:
  lint:    npm run lint
  test:    npm run test -- --coverage
  build:   docker build -t socialos-api .
  e2e:     npm run test:e2e (against test DB)
```

---

## 9. Database Migration Order

Full ordered list — run in sequence:

```
001_auth_extensions.sql
002_tenants.sql
003_profiles.sql
004_tenant_members.sql
005_workspaces.sql
006_permissions.sql             ← seed all permission keys
007_roles.sql
008_role_permissions.sql
009_user_permissions.sql
010_seed_default_roles.sql      ← viewer/editor/manager/admin/super_admin
011_rls_policies_phase1.sql
012_brand_profiles.sql
013_content_items.sql
014_media_assets.sql
015_rls_brand_content.sql
016_social_accounts.sql
017_auto_reply_rules.sql
018_comment_replies.sql
019_rls_social.sql
020_lead_sources.sql
021_leads.sql
022_whatsapp_contacts.sql
023_approval_workflows.sql
024_approval_requests.sql
025_seed_approval_workflows.sql ← content:publish, whatsapp:broadcast, payments:payout
026_rls_leads_whatsapp.sql
027_payouts.sql
028_refunds.sql
029_payment_statements.sql
030_wallet_snapshots.sql
031_rls_payments.sql
032_audit_logs.sql
033_ai_usage.sql
034_rls_audit_ai.sql
```

---

## 10. Open Questions

| # | Question | Impact |
|---|---|---|
| 1 | **PawaPay API token** — Do you have a sandbox token? Production token? | Blocks Phase 5 |
| 2 | **PawaPay key pair** — Do you have an ECDSA P-256 key pair for RFC-9421 request signing, or does it need to be generated and registered in the PawaPay Dashboard? | Blocks Phase 5 signing service |
| 3 | **Mistral model** — Which version? (`mistral-small-latest`, `mistral-large-latest`, `open-mistral-7b`) — affects cost and quality | Blocks Phase 2 content generation |
| 4 | **Image generation provider** — Stability AI, Replicate, or DALL-E 3? | Blocks Phase 2 image generation |
| 5 | **Supported countries / correspondents** — Zambia only for now (`MTN_MOMO_ZMB`, `AIRTEL_MOMO_ZMB`) or multiple? | Affects PawaPay correspondent handling |
| 6 | **Email domain** — Which SendGrid verified sender domain to use? | Blocks notifications in Phase 4 |
| 7 | **Supabase project** — Is the Supabase project created? Do we have service role key + anon key? | Blocks Phase 1 |
| 8 | **Deployment target** — Docker Compose (local/VPS) or Kubernetes? | Affects CI/CD config |
| 9 | **Approval workflows defaults** — Which actions should require approval out of the box: content publish only, or also payouts and WhatsApp broadcasts? | Seeds `025_seed_approval_workflows.sql` |
| 10 | **AI usage limits per plan** — What are the monthly token limits for `starter` and `pro` plans? | Seeds plan config used by UsageGateGuard |

---

*Ready to start Phase 1 once Open Questions 7 (Supabase project) is confirmed.*