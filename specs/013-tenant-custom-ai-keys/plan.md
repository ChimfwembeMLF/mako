# Implementation Plan: Tenant Custom AI Keys & Usage Bypass

**Branch**: `013-tenant-custom-ai-keys` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/013-tenant-custom-ai-keys/spec.md`

## Summary

Tenants need the ability to specify a preferred AI provider (e.g., Mistral, OpenAI) and use their own API keys for AI generation. When they do, the system must bypass standard subscription usage limits. This requires updating the AI service layer to properly route requests based on tenant configuration and ensuring the `tenantId` is passed contextually through all AI feature workflows.

## Technical Context

**Language/Version**: TypeScript (NestJS) and Rust (Axum)

**Primary Dependencies**: NestJS, TypeORM (Node) / Axum, SeaORM (Rust)

**Storage**: PostgreSQL

**Testing**: Jest (Node) / cargo test (Rust)

**Target Platform**: Linux server (Docker/Dokploy)

**Project Type**: Web service (API backend) + UI

**Performance Goals**: AI request routing adds <10ms overhead

**Constraints**: Must securely retrieve encrypted API keys using existing `EncryptionService`

**Scale/Scope**: Impacts all AI functionality across the platform

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Nest–Rust parity**: Live API changes targeted at **BOTH** `api/` (NestJS) and `api-rust/` (Rust) for strict parity.
- [x] **II. Tenancy**: Tenant/workspace scoping and RBAC identified for every data path
- [x] **III. Secrets**: No secrets in spec/plan; OAuth/webhook URLs listed explicitly; Dokploy env remains parser-safe
- [x] **IV. Contracts**: Smoke/contract verification path named for new HTTP, webhook, or publish surfaces
- [x] **V. Background work**: Cron/queue ownership single-process; no dual Nest+Rust workers in the target environment
- [x] **Stack**: Migrations (if any) planned via Nest TypeORM; Docker/Dokploy impact noted

## Project Structure

### Documentation (this feature)

```text
specs/013-tenant-custom-ai-keys/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
api/                 # NestJS (migrations + Nest reference)
api-rust/            # Axum production API (Dokploy `api` service)
client/              # React + Vite SPA
docker-compose.yml   # Dokploy: Rust api + client (+ optional migrate profile)
docs/                # Deploy / Dokploy / cutover docs
specs/               # Spec Kit feature specs
```

**Structure Decision**: Mako Yarn monorepo — implement live API in `api-rust/`, schema in `api/database/migrations`, UI in `client/`. Do not invent a parallel `src/` tree at repo root.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |
