# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]

**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]

**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]

**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]

**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]

**Project Type**: [e.g., library/cli/web-service/mobile-app/compiler/desktop-app or NEEDS CLARIFICATION]

**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]

**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]

**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [ ] **I. Nest–Rust parity**: Live API changes targeted at `api-rust/`; Nest-only
      gaps documented in `api/docs/RUST_MIGRATION.md` if temporary
- [ ] **II. Tenancy**: Tenant/workspace scoping and RBAC identified for every
      data path
- [ ] **III. Secrets**: No secrets in spec/plan; OAuth/webhook URLs listed
      explicitly; Dokploy env remains parser-safe
- [ ] **IV. Contracts**: Smoke/contract verification path named for new HTTP,
      webhook, or publish surfaces
- [ ] **V. Background work**: Cron/queue ownership single-process; no dual Nest+Rust
      workers in the target environment
- [ ] **Stack**: Migrations (if any) planned via Nest TypeORM; Docker/Dokploy
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
