# Tasks: System Wide Tours

**Input**: Design documents from `/specs/014-system-tours/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Update `client/src/services/tour.service.ts` to implement `onHighlightStarted` wait/retry logic for dynamic elements, using `MutationObserver` or polling.
- [ ] T002 Add/update TS interfaces (`TourConfig`, `TourCompletionState`) in `client/src/services/tour.service.ts` based on `data-model.md`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Implement `TourService.autoStartTour()` logic in `client/src/services/tour.service.ts`. This method must check if `user.preferences.tours[tourId].completed` is true before calling `driver.drive()`. If preferences are not already loaded in context, it may need to use a React Context or an API call.

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - New User Onboarding Tour (Priority: P1) 🎯 MVP

**Goal**: As a new user logging into the platform for the first time, I want to be guided through a step-by-step tour of the main interface, so that I can quickly understand how to navigate and use the system.

**Independent Test**: Login with a fresh user; dashboard tour should automatically start. Complete it, refresh, and verify it doesn't start again.

### Implementation for User Story 1

- [ ] T004 [US1] Create tour configuration for Dashboard in `client/src/pages/Dashboard.tour.ts`. Define steps highlighting sidebar, main header, and summary cards.
- [ ] T005 [US1] Update `client/src/pages/Index.tsx` (Dashboard) to call `TourService.autoStartTour(DashboardTourConfig)` on component mount.

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Feature Discovery Tours (Priority: P2)

**Goal**: As a user navigating to a complex page, I want to see a tour explaining the page's capabilities, so that I can utilize advanced features without confusion.

**Independent Test**: Navigate to Content Engine and Brand Brain; tours should auto-start the first time but not subsequently.

### Implementation for User Story 2

- [ ] T006 [P] [US2] Create `client/src/pages/ContentEngine.tour.ts` defining steps for the Content Engine page (Publisher, Scheduler, AI Generation).
- [ ] T007 [P] [US2] Create `client/src/pages/BrandBrain.tour.ts` defining steps for Brand Brain (uploading assets, defining voice).
- [ ] T008 [US2] Update `client/src/pages/ContentEngine.tsx` to call `TourService.autoStartTour(ContentEngineTourConfig)` on component mount.
- [ ] T009 [US2] Update `client/src/pages/BrandBrain.tsx` to call `TourService.autoStartTour(BrandBrainTourConfig)` on component mount.

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Micro-Tours for Modals and Sheets

**Goal**: Deep UI components like Modals and Sheets should have manual "Help/Tour" triggers instead of auto-starting.

**Independent Test**: Open a targeted modal/sheet, click the help button, and verify the tour guides the inner elements correctly, waiting for data if necessary.

### Implementation for User Story 3

- [ ] T010 [P] [US3] Create `client/src/pages/MediaLibrary.tour.ts` defining steps for the media upload modal or asset view.
- [ ] T011 [P] [US3] Add a manual "Tour" button (e.g., an icon button with a `?` or info icon) to `client/src/pages/MediaLibraryPage.tsx`.
- [ ] T012 [US3] Wire the manual button in `client/src/pages/MediaLibraryPage.tsx` to `TourService.startTour(MediaLibraryTourConfig)`.

**Checkpoint**: All user stories should now be independently functional

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T013 [P] Run quickstart.md validation scenarios to ensure all functionality behaves correctly (auto-start, manual triggers, and dynamic element wait).
- [ ] T014 Review and clean up `driver.js` unmounts or stray highlight boxes on React route changes.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- T006, T007 and T010 can be created in parallel.
