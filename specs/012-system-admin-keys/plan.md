# Implementation Plan: System Admin Keys

**Branch**: `012-system-admin-keys` | **Date**: 2026-09-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-system-admin-keys/spec.md`

## Summary

This feature adds a UI for Super Admins to configure platform integrations (API keys) securely via the database, removing the strict reliance on `.env` files. Integration services will be refactored to fetch these keys from the database first, and fall back to the `.env` if they are not set.

## Technical Context

**Language/Version**: TypeScript (NestJS), Rust (api-rust), TypeScript (React/Vite)

**Primary Dependencies**: TypeORM, NestJS, SeaORM (Rust), Axum

**Storage**: PostgreSQL

**Testing**: Jest (NestJS), Cargo Test (Rust)

**Target Platform**: Web (Mako Platform)

**Project Type**: Monorepo Web Application

**Performance Goals**: Database fetching of keys must be fast (caching recommended).

**Constraints**: Security: Keys must be encrypted at rest in the DB and decrypted in-memory before use. Never expose raw keys via API.

**Scale/Scope**: Impacts all integrations (OpenAI, Mistral, Gemini, Deepseek, AWS, Supabase, Google Auth, Meta).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Nest–Rust parity**: Live API changes targeted at **BOTH** `api/` (NestJS) and `api-rust/` (Rust) for strict parity. (Both must fetch from DB before env).
- [x] **II. Tenancy**: Tenant/workspace scoping and RBAC identified for every data path. (This is system-level, so strictly Super Admin RBAC).
- [x] **III. Secrets**: No secrets in spec/plan; Dokploy env remains parser-safe.
- [x] **IV. Contracts**: Smoke/contract verification path named for new HTTP, webhook, or publish surfaces. (N/A for new webhooks, but we verify config retrieval).
- [x] **V. Background work**: Cron/queue ownership single-process; no dual Nest+Rust workers in the target environment. (N/A).
- [x] **Stack**: Migrations (if any) planned via Nest TypeORM; Docker/Dokploy impact noted.

Violations require an entry in Complexity Tracking below.

## Project Structure

### Documentation (this feature)

```text
specs/012-system-admin-keys/
├── plan.md              
├── research.md          
├── data-model.md        
├── quickstart.md        
├── contracts/           
└── tasks.md             
```

### Source Code (repository root)

```text
api/                 # NestJS (migrations + Nest reference)
api-rust/            # Axum production API (Dokploy `api` service)
client/              # React + Vite SPA
```

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
