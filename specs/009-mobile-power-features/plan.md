# Implementation Plan: Mobile Power Features

**Branch**: `009-mobile-power-features` | **Date**: 2026-09-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-mobile-power-features/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

This feature adds advanced mobile capabilities including Push Notifications (via Expo Notifications), Native "Share To" functionality (via Expo Share Intent), Native Camera/Media Editing (via Expo Camera & Manipulator), Offline Drafts & Sync (via AsyncStorage), and lays the groundwork for Home Screen Widgets.

## Technical Context

**Language/Version**: TypeScript, Rust 1.75

**Primary Dependencies**: `expo-notifications`, `expo-share-intent`, `expo-camera`, `expo-image-manipulator`, `@react-native-async-storage/async-storage`, `sea-orm`, `axum`

**Storage**: 
- Client: `AsyncStorage` for offline drafts
- Server: PostgreSQL for push tokens

**Testing**: Jest for React Native, `cargo test` for Rust

**Target Platform**: iOS and Android (Expo Managed Workflow)

**Project Type**: mobile-app (`mobile/`) and web-service (`api-rust/`)

**Performance Goals**: Push notifications delivered within 5 seconds, offline sync completes in <60 seconds

**Constraints**: Rely heavily on Expo SDK, avoid custom bare native code where possible

**Scale/Scope**: Mobile app enhancement spanning both frontend and backend

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Nest–Rust parity**: Live API changes targeted at `api-rust/` (Push Token Registration endpoint)
- [x] **II. Tenancy**: Tenant scoping applies to LocalDrafts
- [x] **III. Secrets**: No secrets in spec/plan
- [x] **IV. Contracts**: Push token schema and endpoints defined
- [x] **V. Background work**: No new background jobs needed
- [x] **Stack**: Migrations via Nest TypeORM for `device_push_tokens` table

## Project Structure

### Documentation (this feature)

```text
specs/009-mobile-power-features/
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
