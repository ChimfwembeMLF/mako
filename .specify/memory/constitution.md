<!--
Sync Impact Report
- Version change: (uninitialized template) → 1.0.0
- Modified principles: N/A (first ratification from placeholders)
- Added sections: Core Principles (I–V), Platform & Stack Constraints,
  Development & Delivery Workflow, Governance
- Removed sections: none (template placeholders replaced)
- Templates requiring updates:
  - .specify/templates/plan-template.md ✅ updated (Constitution Check gates + structure)
  - .specify/templates/tasks-template.md ✅ updated (Mako path conventions)
  - .specify/templates/spec-template.md ✅ updated (tenancy / API parity notes)
  - .specify/templates/checklist-template.md ⚠ pending (no constitution refs yet)
- Follow-up TODOs: none deferred
-->

# Mako Constitution

## Core Principles

### I. Nest–Rust Behavioral Parity (NON-NEGOTIABLE for API work)

The production runtime API is **Rust** (`api-rust/`, Dokploy `api` service).
NestJS (`api/`) remains the **schema and migration owner** (TypeORM) and a
reference implementation until parity is complete.

- MUST implement every new HTTP route, webhook, cron, and queue job in
  `api-rust/` when shipping product features that depend on the live API.
- MUST keep Nest and Rust response shapes and auth semantics aligned for
  shared clients (`client/`). Prefer smoke parity
  (`api-rust/scripts/smoke-parity.sh`) for contract-sensitive changes.
- MUST NOT enable Nest and Rust **crons or queues** on the same environment
  at the same time (double publish / double webhook processing).
- MUST document intentional Nest-only or Rust-only gaps in
  `api/docs/RUST_MIGRATION.md` until closed.

**Rationale**: Dokploy already serves Rust. Shipping Nest-only features
silently breaks production.

### II. Tenant & Workspace Isolation

Mako is multi-tenant. Data and OAuth connections are scoped by `tenantId`
and, where applicable, `workspaceId`.

- MUST enforce membership / RBAC before reading or mutating tenant data.
- MUST NOT leak tokens, messages, media, or leads across tenants or
  workspaces.
- MUST store publisher OAuth tokens in the database per connected account;
  short-lived env user tokens are reference-only, not the runtime source
  of truth for Connect flows.

**Rationale**: Cross-tenant leaks are a security and trust failure.

### III. Secrets & External Integrations Safety

- MUST NOT commit secrets (`.env`, `.env.production`, Dokploy env dumps)
  or paste production credentials into specs, PRs, or chat when avoidable.
- MUST register OAuth callback and webhook URLs exactly as configured in
  provider consoles (Google, Meta, LinkedIn, X, TikTok, WhatsApp).
- MUST treat regenerated provider secrets as compromised if they appeared
  in shared logs or chat; rotate before production use.
- MUST keep Docker/Dokploy `.env` parser-safe: one `KEY=value` per line,
  quote values with spaces, no multi-line PEM blocks for JWT (use
  `JWT_SECRET`).

**Rationale**: OAuth and webhook misconfiguration is a top production
failure mode; secret sprawl is irreversible once published.

### IV. Testable Contracts Over Speculative Abstraction

- SHOULD write failing contract or smoke checks before expanding Nest–Rust
  surface area for user-facing APIs.
- MUST cover new OAuth, webhook CRC, and publish paths with at least one
  automated or documented manual verification path.
- MUST prefer integration/smoke tests for inter-service boundaries
  (Redis queues, Meta/X webhooks, S3 uploads) over unit-only mocks when
  behavior spans systems.
- MUST NOT invent parallel frameworks when Nest or Rust already has a
  working pattern for the same domain.

**Rationale**: Parity bugs hide in mocks; production paths need real
boundary checks.

### V. Simplicity, Observability & Safe Background Work

- MUST keep features as simple as the domain allows (YAGNI). Justify
  complexity in the plan Constitution Check table when violating this.
- MUST emit structured logs for auth failures, publish failures, webhook
  rejects, and queue job failures.
- MUST gate crons with env flags (`*_CRON_ENABLED`, `QUEUES_ENABLED`) and
  default to a single owner process in production.
- MUST serve health at `GET /api/v1/health` with a clear runtime identity
  (e.g. Rust `apiMode`) so cutovers are verifiable.

**Rationale**: Background jobs without single ownership corrupt content
and billing; opaque failures block cutover.

## Platform & Stack Constraints

- **Monorepo**: Yarn 4 workspaces — `api/` (Nest), `api-rust/` (Axum +
  SeaORM), `client/` (React + Vite). Root `yarn.lock` is authoritative.
- **Database**: Shared PostgreSQL. Schema changes MUST go through Nest
  TypeORM migrations (`docker compose --profile migrate` on Dokploy or
  `yarn migrations:run` / `migrations:run:prod`).
- **Queues**: Nest BullMQ or Rust `JobStore` (Redis when `REDIS_HOST` /
  `REDIS_URL` set). Same environment MUST NOT run both queue workers
  against production workloads.
- **Deploy**: Dokploy Docker Compose — Rust API + nginx client. PM2 is
  for optional bare-metal dual-run only, not Dokploy.
- **Frontend**: Follow established Mako UI patterns and `DESIGN.md` brand
  tokens when changing marketing or branded surfaces; preserve existing
  app shell patterns inside the product UI.
- **Docs of record**: `api/docs/RUST_MIGRATION.md`,
  `api/docs/RUST_CUTOVER.md`, `docs/DOKPLOY_RUST.md`,
  `docs/DOKPLOY_ENV.md`.

## Development & Delivery Workflow

1. Specify intent with Spec Kit (`/speckit-specify` → clarify → plan →
   tasks) for non-trivial features.
2. Constitution Check in `plan.md` MUST pass before Phase 0 research
   completes; re-check after design.
3. Implement against **Rust** for live API behavior; update Nest when
   migrations or temporary dual-run require it.
4. Prefer small, reviewable PRs. Do not commit secrets. Do not force-push
   shared branches.
5. Before calling a Nest→Rust cutover “done”, verify health identity,
   smoke parity for touched routes, and that Nest crons/queues are off
   in that environment.

## Governance

- This constitution supersedes informal practice when they conflict.
- Amendments MUST update `.specify/memory/constitution.md`, bump
  **Version** (MAJOR for incompatible principle removal/redefinition;
  MINOR for new principles/sections; PATCH for clarifications), set
  **Last Amended** to the amendment date (ISO `YYYY-MM-DD`), and sync
  Spec Kit templates under `.specify/templates/` when gates or paths
  change.
- Pull requests and agent work that touch APIs, auth, webhooks, queues,
  or deploy MUST be reviewable against Principles I–V.
- Unjustified complexity MUST be recorded in the plan Complexity Tracking
  table or rejected.
- Runtime guidance: `docs/DOKPLOY_RUST.md`, `api/docs/RUST_MIGRATION.md`,
  and agent skills under `.cursor/skills/`.

**Version**: 1.0.0 | **Ratified**: 2026-07-23 | **Last Amended**: 2026-07-23
