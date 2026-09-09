# Implementation Plan: BYOK Tenant Integration

**Branch**: `010-byok-tenant-integration` | **Date**: 2026-09-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/010-byok-tenant-integration/spec.md`

## Summary

Implement Bring Your Own Key (BYOK) functionality to allow tenants to save their own API keys for AI Providers (e.g., OpenAI, Gemini, Mistral). Keys will be encrypted at rest using AES-256 and a master `ENCRYPTION_KEY`. The platform will fallback to a default AI Provider key if a tenant's custom key is invalid or exhausted.

## Technical Context

**Language/Version**: TypeScript (NestJS), Rust (Axum)

**Primary Dependencies**: TypeORM (NestJS migration), SeaORM (Rust backend), `aes-256-gcm` (encryption)

**Storage**: PostgreSQL (new table `tenant_integration_configs`)

**Testing**: jest, cargo test

**Target Platform**: Linux server (Dokploy Docker container)

**Project Type**: web-service (API)

**Performance Goals**: <50ms overhead for decrypting the key during an AI Provider integration call

**Constraints**: AES-256 encryption at rest; keys never exposed to frontend in plain text

**Scale/Scope**: ~1 config per tenant

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Nest–Rust parity**: Schema implemented in `api/` (TypeORM). API logic, routes, and encryption fully implemented in **BOTH** `api/` (NestJS) and `api-rust/` (Rust) for strict parity.
- [x] **II. Tenancy**: New entity will have a strict `tenant_id` foreign key.
- [x] **III. Secrets**: Master encryption key will be provided via `ENCRYPTION_KEY` in the environment.
- [x] **IV. Contracts**: New CRUD endpoints for integration configs must have contract verification.
- [x] **V. Background work**: N/A (no background workers required)
- [x] **Stack**: Migrations planned via Nest TypeORM.

## Project Structure

### Documentation (this feature)

```text
specs/010-byok-tenant-integration/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output
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
