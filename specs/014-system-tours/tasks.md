# Tasks: System Wide Tours

**Input**: Design documents from `/specs/014-system-tours/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: The examples below include test tasks. Tests are OPTIONAL - only include them if explicitly requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Mako monorepo (default)**: `api-rust/src/`, `api/src/`, `client/src/`
- **Migrations**: `api/database/migrations/`
- **Deploy / env docs**: `docs/`, `docker-compose.yml`
- Adjust paths in generated tasks from `plan.md` structure — do not assume a single root `src/` tree

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Add `driver.js` dependency to `client/package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 Add `preferences` JSONB column to NestJS `UserEntity` in `api/src/modules/user/user.entity.ts`
- [x] T003 Generate TypeORM migration for the new column in `api/database/migrations/`
- [x] T004 [P] Add `preferences` JSONB column to Rust `Model` in `api-rust/src/modules/users/entity.rs`
- [x] T005 Implement `PATCH /api/v1/users/me/preferences` endpoint in NestJS `api/src/modules/user/user.controller.ts` and `user.service.ts`
- [x] T006 [P] Implement `PATCH /api/v1/users/me/preferences` endpoint in Rust `api-rust/src/modules/users/routes.rs` and `service.rs`
- [x] T007 Add `preferences` to frontend `User` interface in `client/src/types/user.ts` (or relevant API types file) and API client helper

**Checkpoint**: Foundation ready - Backend parity achieved for storing tour state.

---

## Phase 3: User Story 1 - New User Onboarding Tour (Priority: P1) 🎯 MVP

**Goal**: As a new user, I want a step-by-step tour of the main dashboard so I understand the system.

**Independent Test**: Log in as a new user, reach the dashboard, verify the tour starts automatically.

### Implementation for User Story 1

- [x] T008 [US1] Create `TourService` utility in `client/src/services/tour.service.ts` to wrap `driver.js` initialization and API syncing.
- [x] T009 [US1] Define Dashboard tour configuration steps in `client/src/config/tours/dashboard.tour.ts`
- [x] T010 [US1] Integrate `TourService` into `client/src/pages/Dashboard.tsx` to automatically trigger the tour if `user.preferences.tours.dashboard.completed` is false.
- [x] T011 [US1] Attach relevant CSS IDs/classes to elements in Dashboard components (e.g. Navigation, Quick Actions) mapped by the tour config.

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently.

---

## Phase 4: User Story 2 - Feature Discovery Tours (Priority: P2)

**Goal**: As a user navigating to a complex page like Content Engine, I want a tour explaining capabilities.

**Independent Test**: Open Content Engine for the first time, verify the contextual tour starts.

### Implementation for User Story 2

- [x] T012 [P] [US2] Define Content Engine tour configuration steps in `client/src/config/tours/content-engine.tour.ts`
- [x] T013 [US2] Integrate `TourService` into `client/src/pages/ContentEngine.tsx` to trigger if `content_engine` tour is not completed.
- [x] T014 [US2] Attach relevant CSS IDs/classes to elements in Content Engine components (e.g., Publisher, Scheduler).

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently.

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T015 [P] Add a manual "Help" / "Tour" restart button to the layout header or user dropdown to allow replaying tours.
- [x] T016 Run `quickstart.md` validation to verify Nest/Rust parity and frontend state persistence.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2).
- **User Story 2 (P2)**: Can start after Foundational (Phase 2).

### Parallel Opportunities

- Rust and NestJS foundational tasks (T004, T006 vs T002, T003, T005) can be developed in parallel since they are completely independent implementations.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready
