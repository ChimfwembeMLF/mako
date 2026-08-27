---
description: "Task list template for feature implementation"
---

# Tasks: React Native Mobile App

**Input**: Design documents from `/specs/004-react-native-app/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are OPTIONAL. We will rely on manual quickstart validation for the initial MVP.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- **Mako monorepo (default)**: `mobile/app/`, `mobile/src/`, `mobile/package.json`
- **Deploy / env docs**: `mobile/app.json`, `package.json` (root workspaces)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Initialize Expo project with React Native in `mobile/` directory
- [x] T002 Add `"mobile"` to Yarn monorepo workspaces in `package.json`
- [x] T003 [P] Install core dependencies (`expo-router`, `@tanstack/react-query`, `expo-secure-store`) in `mobile/package.json`
- [x] T004 [P] Create custom theme tokens mapping to `DESIGN.md` in `mobile/src/theme.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Create the API client wrapper configured to hit `EXPO_PUBLIC_API_URL` in `mobile/src/lib/api.ts`
- [x] T006 Set up the root layout with React Query provider in `mobile/app/_layout.tsx`

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - User Authentication (Priority: P1) 🎯 MVP

**Goal**: Users need to be able to sign in or sign up using the mobile application so they can access their data on the go.

**Independent Test**: Can be fully tested by attempting to log in with valid credentials, invalid credentials, and observing the session state.

### Implementation for User Story 1

- [x] T007 [P] [US1] Create the SecureStore wrapper for the session token in `mobile/src/lib/auth-store.ts`
- [x] T008 [P] [US1] Create the API methods for login (hitting `/api/v1/auth/login`) in `mobile/src/lib/api.ts`
- [x] T009 [US1] Implement the `UserSession` state management context in `mobile/src/context/AuthContext.tsx`
- [x] T010 [US1] Implement the Login Screen UI (Sage background, Lime green CTA) in `mobile/app/(auth)/login.tsx`
- [x] T011 [US1] Update `mobile/app/_layout.tsx` to handle authentication routing redirects based on session state

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Core App Navigation (Priority: P2)

**Goal**: Users need a way to navigate between the primary sections of the application seamlessly on a mobile device.

**Independent Test**: Can be fully tested by tapping on the tab bar and ensuring the correct screens are rendered.

### Implementation for User Story 2

- [x] T012 [P] [US2] Create bottom tab layout configuration in `mobile/app/(tabs)/_layout.tsx`
- [x] T013 [P] [US2] Implement Home Screen placeholder fetching `WorkspaceContext` in `mobile/app/(tabs)/index.tsx`
- [x] T014 [P] [US2] Implement Profile Screen fetching `UserProfile` in `mobile/app/(tabs)/profile.tsx`

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T015 [P] Setup offline handling and API timeout interception in `mobile/src/lib/api.ts`
- [x] T016 Run quickstart.md validation locally using Expo Go

## Phase 6: Convergence

- [x] T017 Refactor Home and Profile screens to use `useQuery` from `@tanstack/react-query` per plan: Data Fetching decision (partial)

## Phase 7: Convergence

- [x] T018 Implement a Sign Up screen to allow new user registration per spec.md: US1 (missing)
- [x] T019 Improve error handling in `api.ts` to explicitly detect and handle offline states per spec.md: FR-006 (partial)

## Phase 8: Social Authentication

- [x] T020 Install `expo-auth-session`, `expo-crypto`, and `expo-web-browser` in `mobile/package.json`
- [x] T021 [US1] Add `/api/v1/auth/register` and `/api/v1/auth/google-auth` endpoints to `mobile/src/lib/api.ts`
- [x] T022 [US1] Implement Google OAuth flow using `expo-auth-session` in `mobile/app/(auth)/login.tsx` and `mobile/app/(auth)/signup.tsx`

## Phase 9: Convergence

- [x] T023 Inject `Authorization: Bearer <token>` into outgoing requests in `mobile/src/lib/api.ts` using `getToken()` per FR-004 (missing)
- [x] T024 Update `AuthContext.tsx` to store the full `UserSession` object (with `userId` and `expiresAt`) per data-model.md (partial)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2)
- **User Story 2 (P2)**: Can start after User Story 1 (P1) is complete or in parallel if using mock auth.

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- Screens in US2 can be built in parallel.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
