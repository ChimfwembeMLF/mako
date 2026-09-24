# Implementation Plan: System Wide Tours

**Branch**: `014-system-tours` | **Date**: 2026-09-23 | **Spec**: [spec.md](file:///Users/thecodefather/Documents/personal/projects/mako/specs/014-system-tours/spec.md)

**Input**: Feature specification from `/specs/014-system-tours/spec.md`

## Summary

Implement system-wide interactive user tours using `driver.js` to guide users through the application (main pages like Dashboard, Content Engine, Brand Brain, as well as micro-tours for modals and sheets). Tour completion state is persisted in the database via the `preferences` JSONB column on the `users` table to ensure the tour doesn't trigger repeatedly across different devices. Tour steps will be defined in a decentralized manner, co-located with their respective components. Dynamic elements will be handled via `driver.js` hooks.

## Technical Context

**Language/Version**: TypeScript / React / Node.js (NestJS)

**Primary Dependencies**: `driver.js`, `react`, `@nestjs/common`, `typeorm`

**Storage**: PostgreSQL (`preferences` JSONB column on `users` table already exists and `PATCH /api/v1/users/me/preferences` is functional)

**Testing**: Jest

**Target Platform**: Web Client / Dokploy Server

**Project Type**: Web Application Feature

**Performance Goals**: Negligible rendering impact; lazy loading for `driver.js`.

**Constraints**: Tours must gracefully handle missing DOM elements (e.g. dynamic modal content) and not break the UI.

**Scale/Scope**: System-wide tours (Pages, Modals, Sheets, Filters).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Tenant & Workspace Isolation**: Tour state is saved globally on the user preferences (`users` table), bypassing workspace boundaries since it's a UI preference. The `me` endpoint relies on JWT auth.
- [x] **II. Secrets & External Integrations Safety**: No secrets in spec/plan.
- [x] **III. Testable Contracts Over Speculative Abstraction**: Parity test covered in quickstart via UI verification and API inspection.
- [x] **IV. Simplicity, Observability & Safe Background Work**: Decentralized tour definitions prevent bloating a single configuration file.

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
api/                 # NestJS 
client/              # React + Vite SPA
```

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
