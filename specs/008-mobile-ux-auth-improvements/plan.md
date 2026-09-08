# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Implement native deep-linking for social OAuth, add dynamic tenant-based theming to the mobile app, and redesign the bottom navigation bar to reduce clutter (max 5 tabs).

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript, React Native (Expo SDK 50+), Node.js/Rust (Backend)

**Primary Dependencies**: `expo-auth-session`, `expo-router`, `AsyncStorage` / `zustand`

**Storage**: PostgreSQL (Backend Tenant table), AsyncStorage (Mobile cache)

**Testing**: Manual device testing / Expo Go

**Target Platform**: iOS & Android

**Project Type**: Mobile App & Backend API

**Performance Goals**: Sub-second theme load on launch (cached)

**Constraints**: Must gracefully fallback to web auth if native apps are missing

**Scale/Scope**: Impacts all mobile users and all tenant configurations

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Nest–Rust parity**: Live API changes targeted at `api-rust/`; Nest-only
      gaps documented in `api/docs/RUST_MIGRATION.md` if temporary
- [x] **II. Tenancy**: Tenant/workspace scoping and RBAC identified for every
      data path
- [x] **III. Secrets**: No secrets in spec/plan; OAuth/webhook URLs listed
      explicitly; Dokploy env remains parser-safe
- [x] **IV. Contracts**: Smoke/contract verification path named for new HTTP,
      webhook, or publish surfaces
- [x] **V. Background work**: Cron/queue ownership single-process; no dual Nest+Rust
      workers in the target environment
- [x] **Stack**: Migrations (if any) planned via Nest TypeORM; Docker/Dokploy
      impact noted

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
