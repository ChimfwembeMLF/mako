# Implementation Plan: Social Media Dashboard (separate product shell)

**Branch**: `003-social-dashboard` | **Date**: 2026-07-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-social-dashboard/spec.md`

## Summary

Add a **Social product shell** (`/social`) with its own home overview and social-scoped navigation, while keeping `/dashboard` as the main staff home. Reuse existing social routes/pages and APIs; client-only MVP with optional thin overview composition. Main dashboard gains a clear entry into Social so non-social staff can grow on the main home without sharing the same primary nav density.

## Technical Context

**Language/Version**: TypeScript, React 18, Vite (Yarn workspace `client/`)

**Primary Dependencies**: React Router, existing `DashboardLayout` / `AppNavbar` / `nav-config`, permission hooks, workspace hooks

**Storage**: N/A for MVP (no new tables); reuse workspace-scoped social data via existing APIs

**Testing**: Manual quickstart smoke; optional Playwright later — not required for plan gate

**Target Platform**: Modern browsers; Dokploy client static build

**Project Type**: Web SPA (monorepo frontend)

**Performance Goals**: Social home first paint comparable to `/dashboard`; no extra full-app remount thrash when switching shells

**Constraints**: Client-first; preserve RBAC + workspace isolation; do not fork page implementations; constitution: DESIGN.md for branded chrome; no dual Nest+Rust cron impact

**Scale/Scope**: New routes + nav/layout variants + Social home page + main dashboard entry card; deferred: social-only RBAC roles, WhatsApp-only shell, API aggregation endpoint

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Nest–Rust parity**: N/A for MVP — no new live API routes required (FR-009)
- [x] **II. Tenancy**: Social shell uses existing tenant guards + workspace context; no new data paths
- [x] **III. Secrets**: No secrets; OAuth unchanged
- [x] **IV. Contracts**: UI/nav contract under `contracts/`; manual quickstart verification
- [x] **V. Background work**: N/A
- [x] **Stack**: Client-only; no migrations

Post-design re-check: **PASS** — presentation shell split; tenancy unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/003-social-dashboard/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md              # /speckit-tasks (later)
```

### Source Code (repository root)

```text
client/src/App.tsx
client/src/components/DashboardLayout.tsx
client/src/components/AppNavbar.tsx
client/src/lib/nav-config.ts
client/src/lib/breadcrumbs.ts
client/src/pages/Index.tsx                          # main dashboard — add Social entry
client/src/pages/social/SocialDashboardPage.tsx     # NEW social home
client/src/components/dashboard/PlatformDashboard.tsx  # reuse widgets if useful
client/src/hooks/useWorkspace.tsx
client/src/hooks/usePermissions.tsx
```

**Structure Decision**: Extend existing shell patterns with a **shell mode** (main | social) driven by route prefix `/social`, not a second SPA or parallel layout framework.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
