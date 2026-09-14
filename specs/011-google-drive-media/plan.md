# Implementation Plan: Google Drive Media Integration

**Branch**: `011-google-drive-media` | **Date**: 2026-09-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-google-drive-media/spec.md`

## Summary

Add Google Drive as a media source option. Tenants will connect their Google Drive via OAuth2, list files in the Media Library UI, and import files. Imported files will be streamed from Google Drive API to Mako's S3 bucket to guarantee fast CDN delivery and availability.

## Technical Context

**Language/Version**: TypeScript (NestJS, React) / Rust (Axum)

**Primary Dependencies**: Googleapis (Node), reqwest / google-drive3 (Rust)

**Storage**: PostgreSQL (metadata), S3 (file blobs)

**Testing**: Jest (Nest), Cargo Test (Rust)

**Target Platform**: Web application backend (Dokploy)

**Project Type**: Web Service + UI

**Performance Goals**: File streaming directly to S3 without full-file memory buffering.

**Constraints**: Dual runtime implementation (NestJS & Rust).

**Scale/Scope**: Supports tenant-scoped OAuth integrations and media.

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
specs/011-google-drive-media/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
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
| N/A | N/A | N/A |
