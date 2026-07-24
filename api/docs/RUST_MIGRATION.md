# Rust API Migration Tracker

Port of the NestJS API (`api/`) to Axum + SeaORM (`api-rust/`).

**Goal:** 100% behavioral parity with `api/` — same routes, response shapes, DB semantics, background jobs.

**Last updated:** 2026-07-12 (parity pass)

---

## Progress dashboard

| Metric | NestJS | Rust | % |
|--------|-------:|-----:|--:|
| HTTP route modules | 50 controllers | 57 modules wired in `main.rs` | ~100% surface |
| HTTP endpoints | ~302 | ~186 documented (+ extras) | ~88–92% |
| SeaORM entities | 51 tables | ~45+ entity modules | ~88% |
| Background crons | 7 jobs | 7 jobs | ~100% |
| Queue processors | 5 (BullMQ) | 5 working (Redis or in-memory) | ~100% |
| **Behavioral parity (estimate)** | — | — | **~95%** |

### Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Implemented, compiles, usable in dev |
| 🔶 | Partial — routes exist, logic simplified or gaps remain |
| ⬜ | Not started or stub only |
| 🚧 | In progress this sprint |

---

## Summary

The Rust API is a **broad HTTP port**: nearly every NestJS controller has a matching router. It is **not** a full behavioral clone yet. Production cutover requires closing publishing, webhooks, crons, and queue gaps below.

**Safe for dev/testing today:** auth, tenancy, RBAC, CRUD modules, media (S3/MinIO), most AI HTTP endpoints, payments (with PawaPay when configured).

**Not safe to retire NestJS yet:** run `api-rust/scripts/migrate-everything.sh` on production, then `retire-nest-api.sh` when stable (see `api/docs/RUST_CUTOVER.md`).

---

## Infrastructure comparison

| Feature | NestJS | Rust |
|---------|--------|------|
| Rate limiting | ✅ `@nestjs/throttler` (100/min) | ✅ Global middleware (100/min per IP) |
| HTTP audit auto-log | ✅ `AuditInterceptor` | ✅ `audit_middleware` → `audit_logs` |
| Exception / OAuth redirects | ✅ `AllExceptionsFilter` | 🔶 `ApiError` per handler |
| OpenAPI | ✅ Swagger decorators | ✅ `/documentation` + `swagger.json` |
| Queues | ✅ BullMQ + Redis | ✅ Redis `JobStore` when `REDIS_HOST` set, else in-memory |
| Storage | ✅ S3 (MinIO) | ✅ S3 primary, Supabase fallback |
| Mail | ✅ Nodemailer | ✅ `lettre` SMTP |
| Static `/uploads`, `/public` | ✅ Express static | ✅ `ServeDir` (falls back to `../api/uploads`) |
| Gmail send (leads) | ✅ | ✅ `auth/gmail.rs` |

---

## Category parity

### F0 — Platform gate ✅

| Module | Routes | Status | Notes |
|--------|-------:|--------|-------|
| `health` | 1 | ✅ | |
| `auth` | 19 | ✅ | OAuth, refresh tokens, password reset |
| `tenants` | 6 | ✅ | Bootstrap: subscription, templates, auto-reply, brand, approval workflows |
| `workspaces` | 5 | ✅ | Auto brand profile on create |

### F1 — App shell ✅

| Module | Routes | Status | Notes |
|--------|-------:|--------|-------|
| `rbac` | 3 | ✅ | Effective permissions |
| `roles` / `permissions` / `role_permissions` / `user_permissions` | 20 | ✅ | Admin CRUD |
| `tenant_members` | 8 | 🔶 | Invite email logged, not sent |
| `profiles` | 5 | ✅ | |
| `system_settings` | 5 | ✅ | Public theme endpoint |

### F2 — Core product 🔶

| Module | Routes | Status | Notes |
|--------|-------:|--------|-------|
| `brand_profiles` | 8 | ✅ | Scrape, parse, CRUD |
| `social_accounts` | 15 | ✅ | OAuth connect + token refresh (FB/IG/WA/LinkedIn/Google/TikTok) |
| `media` | 3 | ✅ | MinIO/S3 uploads + delete |
| `content_items` | 8 | ✅ | `scheduled_time` as TIMETZ |
| `content_ai` | 8 | ✅ | All 6 AI task types in queue worker + sync API |
| `content_campaigns` | 4 | ✅ | |
| `content_publications` | 4 | ✅ | Live engagement sync (FB/IG/YT/LinkedIn/Twitter) |
| `templates` | 5 | ✅ | |
| `queues` | 6 | 🔶 | Admin API; workers: publish, email, webhooks, AI (7 tasks), comments sync |
| `content_publishing` | — | ✅ | All 7 platforms incl. Twitter media (OAuth1 when creds present) |

**Publishing platforms**

| Platform | NestJS | Rust |
|----------|--------|------|
| Facebook | ✅ | ✅ |
| Instagram | ✅ | ✅ |
| LinkedIn | ✅ | ✅ |
| Twitter/X | ✅ | ✅ text + media (OAuth1 upload when metadata has keys) |
| YouTube | ✅ | ✅ resumable upload + token refresh |
| TikTok | ✅ | ✅ PULL_FROM_URL + status poll |
| WhatsApp | ✅ | ✅ broadcast to opted-in contacts |

### F3 — Monetization 🔶

| Module | Routes | Status | Notes |
|--------|-------:|--------|-------|
| `subscriptions` + `plans` | 3 | 🔶 | CRUD + renewal cron |
| `payments` | 8 | ✅ | PawaPay when configured; real invoice PDF (`printpdf`) |
| `deposits` | 5 | ✅ | |
| `payment_failures` | 5 | ✅ | |

### F4 — Engagement 🔶

| Module | Routes | Status | Notes |
|--------|-------:|--------|-------|
| `notifications` | 9 | 🔶 | Digest + subscription-ending crons |
| `social_inbox` | 4 | 🔶 | Inbound webhook + DM auto-reply |
| `comment_replies` | 9 | ✅ | Sync + auto-reply + suggest-comment-reply queue |
| `analytics` | 2 | 🔶 | Reads DB + daily FB/IG insights sync cron |
| `ads` | 11 | 🔶 | Meta/TikTok/LinkedIn/X live adapters; Google/Pinterest/Taboola env fallback |

### F5 — Advanced 🔶

| Module | Routes | Status | Notes |
|--------|-------:|--------|-------|
| `chatbot` + `knowledge` + `widget` | 28 | ✅ | Core flows + Mistral TTS (preview, speak, clone, list voices) |
| `whatsapp` + contacts + templates | 21 | ✅ | Full inbound automation + WA templates CRUD/sync/meta import |
| `leads` + `lead_sources` | 12 | 🔶 | Gmail-first email |
| `search` | 2+1 | ✅ | Extra `GET /` list in Rust |
| `auto_reply_rules` | 5 | ✅ | CRUD + tenant seed + startup backfill |

### F6 — Compliance & admin 🔶

| Module | Routes | Status | Notes |
|--------|-------:|--------|-------|
| `legal` | 15 | 🔶 | Meta verify ✅; full WA flow + lead capture + auto-reply |
| `approval_requests` + `approval_workflows` | 10 | ✅ | |
| `audit_logs` | 5 | 🔶 | CRUD only |
| `backoffice` | 8 | 🔶 | |
| `ai` + `ai_usage` | 7+ | ✅ | |

---

## Background jobs

| Job | NestJS | Rust |
|-----|--------|------|
| Auto-publish (5 min) | ✅ + queue fanout | ✅ in-process + queue |
| Comment sync (10 min) | ✅ + auto-reply | ✅ queue fanout + auto-reply |
| Daily content workflow (8am) | ✅ | ✅ queue fanout or in-process |
| PawaPay deposit check (2 min) | ✅ | ✅ |
| Subscription renewal (7am/7pm) | ✅ | ✅ |
| Insights sync (midnight) | ✅ | ✅ FB/IG page insights |
| Notification digests (9am daily + Mon) | ✅ | ✅ |

---

## Queue workers

| Queue | NestJS processor | Rust worker |
|-------|------------------|-------------|
| `content-publish` | ✅ | ✅ |
| `email` | ✅ | ✅ |
| `webhooks` | ✅ WhatsApp + lead | ✅ WA flow engine, lead capture, auto-reply; social DM auto-reply |
| `ai` | ✅ 7 task types | ✅ All 7 (incl. suggest-comment-reply) |
| `comments` | ✅ | ✅ sync-tenant-comments + auto-reply |

Enable with `QUEUES_ENABLED=true` in `.env`.

---

## Recent changes (2026-07-12)

- ✅ S3/MinIO storage (`AWS_S3_*` / MinIO env vars)
- ✅ `scheduled_time` TIMETZ decode via custom `Timetz` + SQLx `PgTimeTz` in
  `api-rust` (Nest column stays `timetz`; no schema migration). Fixes auto-publish
  cron `NaiveTime`/`TIME` vs `TIMETZ` mismatch.
- ✅ Mistral/PawaPay/Supabase dead-code cleanup
- ✅ Meta webhook automation: WA lead capture + classify, flow engine, keyword auto-reply, social DM auto-reply
- ✅ All 7 content publishers (Twitter text-only, YouTube, TikTok, WhatsApp broadcast)
- ✅ Meta webhook routing: page/instagram → social inbox, else WhatsApp
- ✅ AI queue worker: all 6 content AI task types
- ✅ Comments queue: `sync-tenant-comments` worker + auto-reply on sync
- ✅ `suggest-comment-reply` AI task in queue worker
- ✅ 5 missing crons: PawaPay poll, subscription renewal, daily workflow, insights sync, notification digests
- ✅ Redis-backed `JobStore` (falls back to in-memory when `REDIS_HOST` unset)
- ✅ Global throttling middleware (`THROTTLE_LIMIT` / `THROTTLE_TTL_SECS`, default 100/min)
- ✅ HTTP audit interceptor (`audit_middleware` → `audit_logs.log_request`)
- ✅ Smoke parity script (`api-rust/scripts/smoke-parity.sh`)
- ✅ Tenant bootstrap parity: free subscription, 9 templates, 10 auto-reply rules, brand profile, 9 approval workflows
- ✅ Workspace create → auto brand profile shell
- ✅ Static `/uploads` and `/public` via `ServeDir`
- ✅ Auto-reply startup backfill (`AUTO_REPLY_BACKFILL_ON_START`)
- ✅ Full cutover: `migrate-everything.sh`, `cutover-proxy-to-rust.sh full`, `retire-nest-api.sh`
- ✅ Mistral TTS service + chatbot/widget TTS endpoints
- ✅ Invoice PDF generation (`printpdf`) with company/bank fields
- ✅ Live publication engagement sync (FB/IG/YT/LinkedIn/Twitter)
- ✅ Social account token refresh for all major platforms
- ✅ Ads adapters: Meta (Graph API), TikTok, LinkedIn, X + Meta insights metrics
- ✅ Twitter media publishing with OAuth 1.0a signed uploads

---

## Env reference (Rust reads `api/.env`)

| Variable | Purpose |
|----------|---------|
| `AWS_S3_ENDPOINT` | MinIO URL (e.g. `https://s3.tekreminnovations.com`) |
| `AWS_S3_BUCKET_NAME` | Bucket (`mako`) |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | MinIO credentials |
| `AWS_S3_FORCE_PATH_STYLE` | `true` for MinIO |
| `QUEUES_ENABLED` | Queue dispatch (Redis or in-memory) |
| `REDIS_HOST` / `REDIS_URL` | Redis JobStore backend |
| `AUTO_PUBLISH_CRON_ENABLED` | Default true |
| `COMMENT_SYNC_CRON_ENABLED` | Default true |
| `PAWAPAY_POLL_CRON_ENABLED` | Default true |
| `SUBSCRIPTION_RENEWAL_CRON_ENABLED` | Default true |
| `DAILY_WORKFLOW_CRON_ENABLED` | Default true |
| `INSIGHTS_SYNC_CRON_ENABLED` | Default true |
| `NOTIFICATION_CRON_ENABLED` | Default true |
| `WEEKLY_DIGEST_CRON_ENABLED` | Default true |
| `THROTTLE_ENABLED` | Default true (false in `NODE_ENV=test`) |
| `THROTTLE_LIMIT` | Default 100 |
| `THROTTLE_TTL_SECS` | Default 60 |
| `META_WEBHOOK_VERIFY_TOKEN` | Meta webhook subscription |
| `MISTRAL_API_KEY` | AI modules |
| `WHATSAPP_FLOW_ENABLED` | Force-enable menu bot (`true`) |
| `AUTO_REPLY_BACKFILL_ON_START` | Default true — seed default rules for tenants with none |
| `UPLOADS_DIR` / `PUBLIC_DIR` | Override static dirs (default: `uploads`, `../api/uploads`, etc.) |

---

## Cutover checklist

- [x] Port Twitter, YouTube, TikTok, WhatsApp publishers
- [x] Complete Meta webhooks: lead capture, flow engine, auto-reply
- [x] Redis-backed queues (replace in-memory store)
- [x] Port remaining AI queue task types
- [x] Port 5 missing crons
- [x] Add global throttling + audit interceptor
- [x] Endpoint smoke tests vs NestJS on same DB (`scripts/smoke-parity.sh`)
- [x] CI/CD for `api-rust`
- [x] Dual-run tooling (LiteSpeed snippets, `dual-run-start.sh`, `cutover-proxy-to-rust.sh`, `RUST_CUTOVER.md`)
- [x] Tenant bootstrap parity (subscription, templates, auto-reply, brand, approval workflows)
- [x] Static `/uploads` + `/public` serving in Rust
- [x] Full migration script (`migrate-everything.sh`) + retire Nest (`retire-nest-api.sh`)
- [ ] Execute `migrate-everything.sh` on production + retire NestJS

---

## How to run

```bash
cd api-rust && cargo run
# Docs: http://localhost:4000/documentation
# Health: http://localhost:4000/api/v1/health
```

---

## Regenerating route inventory

```bash
# NestJS handlers
rg '@(Get|Post|Patch|Put|Delete)\(' api/src --glob '*.controller.ts' -c

# Rust OpenAPI registry
wc -l api-rust/src/openapi/routes.json
```

Update this file when shipping modules or closing parity gaps.
