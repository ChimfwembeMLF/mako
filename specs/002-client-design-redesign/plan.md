# Implementation Plan: Client UI redesign from DESIGN.md

**Branch**: `002-client-design-redesign` | **Date**: 2026-07-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-client-design-redesign/spec.md`

## Summary

Migrate the React client from the Airbnb-inspired Rausch theme to the Wise-inspired system in `DESIGN.md`: lime primary `#9fe870`, sage canvas `#e8ebe6`, near-black ink, 24px card/button radius, Inter + heavy display substitute. Ship in layers — tokens → marketing/auth shells → dashboard shell + shared primitives — without changing API behavior or rewriting every product page in v1.

## Technical Context

**Language/Version**: TypeScript, React 18, Vite (Yarn workspace `client/`)

**Primary Dependencies**: Tailwind CSS, shadcn/ui (Radix), React Router, existing `client/src/components/ui/*`

**Storage**: N/A (presentation only)

**Testing**: Manual UI checklist in quickstart; optional Playwright/visual later — not required for plan gate

**Target Platform**: Modern browsers; Dokploy nginx `client` static build; mobile + desktop

**Project Type**: Web SPA (monorepo frontend)

**Performance Goals**: No material LCP regression on landing; fonts subset/display-swap; avoid layout thrash

**Constraints**: Client-only; preserve routes and auth; keep OAuth provider button colors; semantic success ≠ CTA lime; constitution: DESIGN.md for marketing, don’t break product workflows

**Scale/Scope**: Token files + Landing + Auth + DashboardLayout + Button/Card/Input/Badge primitives; deferred: deep restyle of all 40+ feature pages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Nest–Rust parity**: N/A — no API changes
- [x] **II. Tenancy**: N/A — no data-path changes; UI remains behind existing guards
- [x] **III. Secrets**: No secrets in design artifacts
- [x] **IV. Contracts**: UI contract documented under `contracts/` (token + shell visual contract); manual quickstart verification
- [x] **V. Background work**: N/A
- [x] **Stack**: Frontend follows `DESIGN.md`; product shell restyled via tokens/primitives without inventing a parallel component framework

Post-design re-check: **PASS** — client-only; DESIGN.md is SoT; app workflows preserved.

## Project Structure

### Documentation (this feature)

```text
specs/002-client-design-redesign/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md              # /speckit-tasks (later)
```

### Source Code (repository root)

```text
DESIGN.md                          # Source of truth (Wise-inspired)
client/src/index.css               # CSS variables
client/src/lib/design-tokens.ts    # TS token mirror
client/src/lib/mako-brand.ts       # Brand hex helpers
client/tailwind.config.ts          # Tailwind theme bridge
client/vite.config.ts              # PWA theme_color
client/src/pages/LandingPage.tsx
client/src/pages/auth/Auth.tsx
client/src/components/DashboardLayout.tsx
client/src/components/ui/          # Button, Card, Input, Badge, …
```

**Structure Decision**: Evolve existing Tailwind/shadcn token bridge; do not add a second design-system package.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
