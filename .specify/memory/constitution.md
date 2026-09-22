<!--
Sync Impact Report
- Version change: 1.1.0 → 1.2.0
- Modified principles: Removed I. Nest–Rust Behavioral Parity
- Added sections: none
- Removed sections: none
- Templates requiring updates:
  - .specify/templates/plan-template.md ✅ updated
  - .specify/templates/spec-template.md ✅ updated
- Follow-up TODOs: Update plan and spec templates to reflect pure NestJS architecture.
-->

# Mako Constitution

## Core Principles

### I. Tenant & Workspace Isolation

Mako is multi-tenant. Data and OAuth connections are scoped by `tenantId`
and, where applicable, `workspaceId`.

- MUST enforce membership / RBAC before reading or mutating tenant data.
- MUST NOT leak tokens, messages, media, or leads across tenants or
  workspaces.
- MUST store publisher OAuth tokens in the database per connected account;
  short-lived env user tokens are reference-only, not the runtime source
  of truth for Connect flows.

**Rationale**: Cross-tenant leaks are a security and trust failure.

### II. Secrets & External Integrations Safety

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

### III. Testable Contracts Over Speculative Abstraction

- MUST cover new OAuth, webhook CRC, and publish paths with at least one
  automated or documented manual verification path.
- MUST prefer integration/smoke tests for inter-service boundaries
  (Redis queues, Meta/X webhooks, S3 uploads) over unit-only mocks when
  behavior spans systems.
- MUST NOT invent parallel frameworks when NestJS already has a
  working pattern for the same domain.

**Rationale**: Production paths need real boundary checks.

### IV. Simplicity, Observability & Safe Background Work

- MUST keep features as simple as the domain allows (YAGNI). Justify
  complexity in the plan Constitution Check table when violating this.
- MUST emit structured logs for auth failures, publish failures, webhook
  rejects, and queue job failures.
- MUST gate crons with env flags (`*_CRON_ENABLED`, `QUEUES_ENABLED`) and
  default to a single owner process in production.
- MUST serve health at `GET /api/v1/health` so cutovers are verifiable.

**Rationale**: Background jobs without single ownership corrupt content
and billing; opaque failures block cutover.

## Platform & Stack Constraints

- **Monorepo**: Yarn 4 workspaces — `api/` (NestJS), `client/` (React + Vite), `mobile/` (Expo). Root `yarn.lock` is authoritative.
- **Database**: Shared PostgreSQL. Schema changes MUST go through Nest
  TypeORM migrations (`docker compose --profile migrate` on Dokploy or
  `yarn migrations:run` / `migrations:run:prod`).
- **Queues**: Nest BullMQ.
- **Deploy**: Dokploy Docker Compose — NestJS API (`mako-api`) + React client (`mako-client`).
- **Frontend**: Follow established Mako UI patterns and `DESIGN.md` brand
  tokens when changing marketing or branded surfaces; preserve existing
  app shell patterns inside the product UI.
- **Docs of record**: `docs/DOKPLOY_ENV.md`.

## Development & Delivery Workflow

1. Specify intent with Spec Kit (`/speckit-specify` → clarify → plan →
   tasks) for non-trivial features.
2. Constitution Check in `plan.md` MUST pass before Phase 0 research
   completes; re-check after design.
3. Prefer small, reviewable PRs. Do not commit secrets. Do not force-push
   shared branches.

## Governance

- This constitution supersedes informal practice when they conflict.
- Amendments MUST update `.specify/memory/constitution.md`, bump
  **Version** (MAJOR for incompatible principle removal/redefinition;
  MINOR for new principles/sections; PATCH for clarifications), set
  **Last Amended** to the amendment date (ISO `YYYY-MM-DD`), and sync
  Spec Kit templates under `.specify/templates/` when gates or paths
  change.
- Pull requests and agent work that touch APIs, auth, webhooks, queues,
  or deploy MUST be reviewable against Principles I–IV.
- Unjustified complexity MUST be recorded in the plan Complexity Tracking
  table or rejected.
- Runtime guidance: agent skills under `.agents/skills/`.

**Version**: 1.2.0 | **Ratified**: 2026-07-23 | **Last Amended**: 2026-09-22
