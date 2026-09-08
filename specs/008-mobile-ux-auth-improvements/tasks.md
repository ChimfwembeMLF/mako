# Tasks: Mobile UX and Auth Improvements

**Input**: Design documents from `/specs/008-mobile-ux-auth-improvements/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Verify `expo-auth-session` is correctly configured for native schemes in `mobile/app.json`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Create TypeORM migration in `api/database/migrations/` to add `themePrimaryColor`, `themeSecondaryColor`, `themeLogoUrl`, `themeRadius` to the `Tenant` table. (Note: Already supported via `themeConfig` JSONB column)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Native Social Connection Deep Linking (Priority: P1) 🎯 MVP

**Goal**: Open native social apps instead of web wrappers when connecting accounts.

**Independent Test**: Connect Google/Meta with the native app installed; verify it opens the native app, not a browser.

### Implementation for User Story 1

- [X] T003 [US1] Update `mobile/src/hooks/useGoogleAuth.tsx` (and other auth hooks) to set `useProxy: false` so it attempts deep-linking.
- [X] T004 [US1] Ensure `mobile/src/lib/oauth-redirect.ts` generates valid redirect schemas for deep linking.

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Admin-Driven Dynamic Theming (Priority: P2)

**Goal**: Mobile app dynamically applies tenant branding on launch.

**Independent Test**: Change tenant color via API and see it reflect in the mobile app.

### Implementation for User Story 2

- [X] T005 [P] [US2] Implement `GET /api/v1/tenants/:tenantId/theme` endpoint in `api-rust/src/` (Axum handler).
- [X] T006 [P] [US2] Create theme state manager in `mobile/src/store/themeStore.ts` (using `zustand` and `AsyncStorage` for persistence).
- [X] T007 [US2] Update `mobile/app/_layout.tsx` to fetch the theme on launch and inject it into a ThemeProvider.
- [X] T008 [US2] Update core UI components (buttons, headers) in `mobile/src/components/` to read colors from the theme store instead of hardcoded values.

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Intuitive Bottom Navigation (Priority: P3)

**Goal**: Redesign bottom navigation to reduce clutter (max 5 tabs).

**Independent Test**: Visually verify bottom bar spacing and tab count.

### Implementation for User Story 3

- [X] T009 [US3] Refactor `mobile/app/(tabs)/_layout.tsx` to consolidate secondary tabs into a "More" or "Menu" tab, leaving max 5 primary tabs.
- [X] T010 [US3] Update tab styling in `mobile/app/(tabs)/_layout.tsx` to increase padding and touch targets to at least 44x44pt.

**Checkpoint**: All user stories should now be independently functional

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T011 Run quickstart.md validation to ensure all flows (Native Auth, Theming) work end-to-end.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Independently testable

### Parallel Opportunities

- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows).
- API backend tasks (T005) and mobile state setup (T006) for US2 can run in parallel.

## Phase 6: Convergence

- [x] T012 Refactor `mobile/src/store/themeStore.tsx` to use `zustand` state manager per `plan: storage decision` (`partial`)
