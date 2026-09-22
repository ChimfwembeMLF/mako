# Implementation Plan: System Wide Tours

**Branch**: `014-system-tours` | **Date**: 2026-09-22 | **Spec**: [spec.md](file:///Users/thecodefather/Documents/personal/projects/mako/specs/014-system-tours/spec.md)

**Input**: Feature specification from `/specs/014-system-tours/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Implement system-wide interactive user tours using `driver.js` to guide users through the Dashboard and Content Engine. Tour completion state will be persisted in the database via a new `preferences` JSONB column on the `users` table to ensure the tour doesn't trigger repeatedly across different devices.

## Technical Context

**Language/Version**: TypeScript / React / Node.js (NestJS) / Rust (Axum)

**Primary Dependencies**: `driver.js`, `react`, `@nestjs/common`, `sea-orm`

**Storage**: PostgreSQL (adding JSONB column to `users` table)

**Testing**: Jest (NestJS), Cargo Test (Rust)

**Target Platform**: Web Client / Dokploy Server

**Project Type**: Web Application Feature

**Performance Goals**: Negligible rendering impact; lazy loading for `driver.js`.

**Constraints**: Tours must gracefully handle missing DOM elements and not break the UI.

**Scale/Scope**: 2 initial tours (Dashboard, Content Engine).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Nest–Rust parity**: Live API changes targeted at **BOTH** `api/` (NestJS) and `api-rust/` (Rust) for strict parity. (Adding `PATCH /api/v1/users/me/preferences`).
- [x] **II. Tenancy**: Tenant/workspace scoping and RBAC identified for every data path. (Preferences are per-user, `me` endpoint relies on JWT auth).
- [x] **III. Secrets**: No secrets in spec/plan; OAuth/webhook URLs listed explicitly; Dokploy env remains parser-safe.
- [x] **IV. Contracts**: Smoke/contract verification path named for new HTTP, webhook, or publish surfaces. (Quickstart covers parity test).
- [x] **V. Background work**: Cron/queue ownership single-process; no dual Nest+Rust workers in the target environment. (N/A).
- [x] **Stack**: Migrations (if any) planned via Nest TypeORM; Docker/Dokploy impact noted. (NestJS TypeORM migration required for `users.preferences`).

Violations require an entry in Complexity Tracking below.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
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

**Structure Decision**: Mako Yarn monorepo — implement live API in `api-rust/`,
schema in `api/database/migrations`, UI in `client/`. Do not invent a parallel
`src/` tree at repo root.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
