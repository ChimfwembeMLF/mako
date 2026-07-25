---
description: "Task list for Social Media Dashboard (separate product shell)"
---

# Tasks: Social Media Dashboard (separate product shell)

**Input**: Design documents from `/specs/003-social-dashboard/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Manual only (quickstart) — no automated test tasks unless added later

**Organization**: By user story (shell foundation → Social home → Social nav → main entry → workspace polish)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallelizable (different files, no incomplete-task dependency)
- **[Story]**: [US1] / [US2] / [US3] / [US4]
- Exact file paths in every task

## Path Conventions

- Shell: `client/src/lib/nav-config.ts`, `client/src/lib/social-shell.ts` (new), `client/src/components/AppNavbar.tsx`, `client/src/components/DashboardLayout.tsx`
- Routes: `client/src/App.tsx`, `client/src/lib/breadcrumbs.ts`
- Pages: `client/src/pages/social/SocialDashboardPage.tsx` (new), `client/src/pages/Index.tsx`
- Context: `client/src/hooks/useWorkspace.tsx`, `client/src/hooks/usePermissions.tsx`
- Contracts: `specs/003-social-dashboard/contracts/ui-shells.md`
- SoT decisions: `specs/003-social-dashboard/research.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm branch and inventory current shell/nav surfaces

- [X] T001 Confirm branch `003-social-dashboard` and review `specs/003-social-dashboard/plan.md`, `spec.md`, and `contracts/ui-shells.md`
- [X] T002 [P] Inventory current dashboard/nav wiring in `client/src/App.tsx`, `client/src/components/DashboardLayout.tsx`, `client/src/components/AppNavbar.tsx`, and `client/src/lib/nav-config.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shell mode detection and path lists shared by all stories

**⚠️ CRITICAL**: Complete before user story implementation

- [X] T003 Create `client/src/lib/social-shell.ts` with `ProductShell` type (`'main' | 'social'`), `SOCIAL_PATH_PREFIXES` per research R1/R6 and `contracts/ui-shells.md`, plus `resolveProductShell(pathname)` helper
- [X] T004 [P] Export `SOCIAL_NAV_GROUPS` (and optional WhatsApp item per research R2) from `client/src/lib/nav-config.ts` without changing default `NAV_GROUPS` behavior yet
- [X] T005 Add social-permission helper (any of content/replies/analytics/publisher-related `P.*` keys) in `client/src/lib/social-shell.ts` or beside `client/src/lib/permissions.ts` for `/social` gate
- [X] T006 Wire `DashboardLayout` / shell context so chrome can read current `ProductShell` from location via `resolveProductShell` in `client/src/components/DashboardLayout.tsx`

**Checkpoint**: Shell mode + social nav data exist — US1/US2 can start

---

## Phase 3: User Story 1 - Enter Social Dashboard (Priority: P1) 🎯 MVP

**Goal**: Dedicated `/social` home with social overview; `/dashboard` unchanged; RBAC gate.

**Independent Test**: Sign in → `/social` shows social overview + social chrome; `/dashboard` still general; no social perms → redirect/deny.

### Implementation for User Story 1

- [X] T007 [US1] Create `client/src/pages/social/SocialDashboardPage.tsx` composing overview widgets (connections / upcoming posts / inbox highlight and/or reuse `PlatformDashboard` from `client/src/components/dashboard/PlatformDashboard.tsx`)
- [X] T008 [US1] Register protected route `/social` (and optional redirect `/social/dashboard` → `/social`) in `client/src/App.tsx` under existing `DashboardLayout` / `ProtectedRoute`
- [X] T009 [US1] Enforce social-permission gate on Social home (redirect to `/dashboard` or existing deny pattern) using `usePermissions` in `SocialDashboardPage.tsx` or route wrapper
- [X] T010 [P] [US1] Add breadcrumb label for `/social` in `client/src/lib/breadcrumbs.ts`
- [X] T011 [US1] Verify `/dashboard` still renders `client/src/pages/Index.tsx` without social-only replacement

**Checkpoint**: US1 MVP — two distinct homes exist

---

## Phase 4: User Story 2 - Social-scoped navigation (Priority: P1)

**Goal**: In Social shell, Apps shows `SOCIAL_NAV_GROUPS` only; Main app switcher; main shell keeps full `NAV_GROUPS`.

**Independent Test**: On `/social` or social path, Apps = social only; control returns to `/dashboard`; on main, Apps includes Leads/Mail/Chatbot.

### Implementation for User Story 2

- [X] T012 [US2] Update `client/src/components/AppNavbar.tsx` to select `SOCIAL_NAV_GROUPS` vs `NAV_GROUPS` from `resolveProductShell(pathname)`
- [X] T013 [US2] Set Social shell top Dashboard/home link to `/social` and add “Main app” / “All products” control → `/dashboard` in `client/src/components/AppNavbar.tsx`
- [X] T014 [US2] On main shell, keep `DASHBOARD_NAV` → `/dashboard` and full `NAV_GROUPS`; add Social entry link to `/social` in navbar (per contracts) in `client/src/components/AppNavbar.tsx`
- [X] T015 [P] [US2] Ensure `MORE_ITEMS` (Team, Workspaces, Settings, etc.) remain available in both shells in `client/src/components/AppNavbar.tsx`
- [X] T016 [US2] Confirm social path prefixes (e.g. `/content`, `/scheduler`, `/replies`) activate Social chrome via `SOCIAL_PATH_PREFIXES` in `client/src/lib/social-shell.ts`

**Checkpoint**: Scoped Social nav works without forking pages

---

## Phase 5: User Story 3 - Main dashboard room for more staff (Priority: P2)

**Goal**: Main `/dashboard` gains a prominent Social entry so other staff modules remain first-class.

**Independent Test**: `/dashboard` shows Social CTA/card; Leads/Mail/Chatbot cards still present.

### Implementation for User Story 3

- [X] T017 [US3] Add prominent Social Dashboard card/CTA linking to `/social` on `client/src/pages/Index.tsx` (research R3)
- [X] T018 [P] [US3] Keep or lightly reorganize existing module cards on `client/src/pages/Index.tsx` so non-social modules (Leads, Mail, Chatbot, Team) remain visible — do not remove them

**Checkpoint**: Main home discovers Social without losing other staff entry points

---

## Phase 6: User Story 4 - Same tenancy & workspace (Priority: P2)

**Goal**: Social home respects active workspace; More → Team/Workspaces works from Social shell.

**Independent Test**: Switch workspace on `/social` → overview refreshes; Team/Workspaces from More load.

### Implementation for User Story 4

- [X] T019 [US4] Bind Social overview data fetches to active `workspaceId` from `useWorkspace` in `client/src/pages/social/SocialDashboardPage.tsx`
- [X] T020 [US4] Smoke-verify workspace switcher in header updates Social overview; opening Team/Workspaces from More leaves shared settings pages working under Social chrome where path is non-social (main chrome) per R6

**Checkpoint**: No tenancy/workspace regressions

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Quickstart pass and mobile/UX cleanup

- [X] T021 [P] Run manual checklist in `specs/003-social-dashboard/quickstart.md` and fix shell/nav regressions only
- [X] T022 [P] Spot-check mobile navbar stacking for Social shell in `client/src/components/AppNavbar.tsx` (~48px controls where applicable)
- [X] T023 Confirm no Nest/Rust API or schema changes — presentation-only under `client/` (FR-009)
- [X] T024 [P] Update obsolete comments if any claiming a single dashboard shell only in touched nav/layout files

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Immediate
- **Foundational (Phase 2)**: After Setup — blocks all stories
- **US1 (Phase 3)**: After Phase 2 — **MVP**
- **US2 (Phase 4)**: After Phase 2; strongly after US1 route exists for home link
- **US3 (Phase 5)**: After US1 (`/social` exists for CTA)
- **US4 (Phase 6)**: After US1 overview page exists
- **Polish (Phase 7)**: After desired stories

### User Story Dependencies

- **US1**: Needs foundational shell helpers + route
- **US2**: Needs foundational `SOCIAL_NAV_GROUPS` + shell resolve; benefits from US1 `/social`
- **US3**: Needs US1 route target
- **US4**: Needs US1 page data wiring

### Parallel Opportunities

- T002 with T001
- T004 ∥ T003 after inventory
- T010 ∥ T007–T009 once route settled
- T015 ∥ T012–T014 (careful if same file — prefer sequential in AppNavbar)
- T017 ∥ T018 on Index if coordinated
- T021 ∥ T022 ∥ T024 in polish

---

## Parallel Example: User Story 1

```bash
# After foundation:
Task: "Create SocialDashboardPage.tsx"
Task: "Register /social in App.tsx"
Task: "Add breadcrumbs for /social"
```

## Parallel Example: User Story 2

```bash
# After SOCIAL_NAV_GROUPS exists:
Task: "AppNavbar shell-aware Apps menu"
Task: "Main ↔ Social switcher controls"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1–2 setup/foundation  
2. Phase 3 `/social` home + gate  
3. **STOP**: Demo two homes  
4. Add US2 nav scoping next  

### Incremental Delivery

1. US1 → Social home exists  
2. US2 → Social-scoped Apps menu  
3. US3 → Main dashboard Social card  
4. US4 → Workspace-bound overview  
5. Polish → quickstart  

### Parallel Team Strategy

1. Dev A: foundation + US1 page  
2. Dev B: AppNavbar shell switching (US2) after T003–T004  
3. Dev C: Index Social card (US3) after `/social` lands  

---

## Notes

- Do **not** duplicate page components under `/social/content` in v1 (research R1 option B)
- Do **not** add Nest/Rust overview API unless composition proves insufficient
- Do **not** invent a Staff entity — main dashboard UX only
- Preserve DESIGN.md tokens; no parallel design system

---

## Task Summary

| Phase | Tasks | Count |
|-------|-------|-------|
| Setup | T001–T002 | 2 |
| Foundational | T003–T006 | 4 |
| US1 (P1 MVP) | T007–T011 | 5 |
| US2 (P1) | T012–T016 | 5 |
| US3 (P2) | T017–T018 | 2 |
| US4 (P2) | T019–T020 | 2 |
| Polish | T021–T024 | 4 |
| **Total** | T001–T024 | **24** |

## Phase 8: Convergence

**Purpose**: Close gaps found by `/speckit-converge` against current code (Social home overview removed after PlatformDashboard deletion).

- [X] T025 Restore Social home overview on `client/src/pages/social/SocialDashboardPage.tsx` with connections status, upcoming posts/queue, and inbox highlights (compose existing APIs or a Social-only widget component) per US1/AC1 and plan R4 (`missing`) — do not reintroduce the “Published via Mako” engagement block on `client/src/pages/Index.tsx`
- [X] T026 Bind Social overview data fetches to active `workspaceId` from `useWorkspace` and remount/refresh on workspace switch in `client/src/pages/social/SocialDashboardPage.tsx` per US4/AC1 and SC-004 (`missing`)
- [X] T027 [P] Add a Mail module card (and keep Leads/Chatbot) on `client/src/pages/Index.tsx` so non-social staff entry points match US3/AC2 / T018 (`partial`)
