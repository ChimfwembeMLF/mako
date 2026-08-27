---
description: "Task list for Mobile Core Features"
---

# Tasks: Mobile Core Features

**Input**: Design documents from `/specs/005-mobile-core-features/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Manual quickstart validation only (no automated test tasks unless requested later).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Mobile app**: `mobile/app/`, `mobile/src/`
- **Contracts reference**: `specs/005-mobile-core-features/contracts/mobile-api.md`
- **Env / docs**: `mobile/.env.example`, `specs/005-mobile-core-features/quickstart.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies and env scaffolding for core feature screens

- [x] T001 Add `expo-image-picker` dependency in `mobile/package.json`
- [x] T002 [P] Create `mobile/.env.example` documenting `EXPO_PUBLIC_API_URL` and Google OAuth public client IDs
- [x] T003 [P] Align `mobile/app.json` app `name`/`slug`/`scheme` toward Mako branding (no secrets)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: API client + workspace scoping that ALL stories need

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Split public vs authenticated fetch in `mobile/src/lib/api.ts` (`fetchPublic` for login/register/google/refresh; `fetchWithAuth` keeps 401 refresh only for authed routes) per `contracts/mobile-api.md`
- [x] T005 Extend `mobile/src/lib/api.ts` with typed helpers for content-items, media upload, content-ai publish, social-accounts, and inbox endpoints from `contracts/mobile-api.md`
- [x] T006 Harden `mobile/src/context/WorkspaceContext.tsx` to validate active workspace against list, clear stale IDs, and always expose `tenantId` + `workspaceId` for scoped calls
- [x] T007 Wire React Query `queryClient.clear()` into sign-out in `mobile/src/context/AuthContext.tsx` and `mobile/app/_layout.tsx`

**Checkpoint**: Foundation ready — user story implementation can begin

---

## Phase 3: User Story 1 - Reliable session and sign-in (Priority: P1) 🎯 MVP

**Goal**: Cold start reaches home with a valid session; bad passwords show credential errors; sign-out clears prior user data.

**Independent Test**: Sign in → force-quit → reopen lands on tabs; wrong password shows auth error (not session expired); switch users shows no leaked cache.

### Implementation for User Story 1

- [x] T008 [US1] Fix cold-start routing so authenticated users on `/` redirect to `/(tabs)` in `mobile/app/index.tsx` and/or `mobile/app/_layout.tsx`
- [x] T009 [US1] Route `api.login` / `api.signup` / `api.googleAuth` through `fetchPublic` in `mobile/src/lib/api.ts` and keep credential error messages in `mobile/app/(auth)/login.tsx` and `mobile/app/(auth)/signup.tsx`
- [x] T010 [US1] Surface SecureStore write failures from `mobile/src/lib/auth-store.ts` to `signIn` in `mobile/src/context/AuthContext.tsx` (do not claim persisted session if save failed)
- [x] T011 [US1] Call `POST /api/v1/auth/logout` on sign-out when possible from `mobile/src/context/AuthContext.tsx` before `clearSession`

**Checkpoint**: US1 fully testable — stop here for MVP reliability demo if needed

---

## Phase 4: User Story 2 - Create and publish content on the go (Priority: P1)

**Goal**: Draft, attach media, publish now, and schedule posts for the active workspace.

**Independent Test**: Create draft → optional image → publish to one connected platform → see success/failure; schedule a draft and see it as scheduled.

### Implementation for User Story 2

- [x] T012 [P] [US2] Add Content tab route stubs in `mobile/app/(tabs)/_layout.tsx` and `mobile/app/(tabs)/content/index.tsx`
- [x] T013 [US2] Implement content list (draft/scheduled/published) with React Query in `mobile/app/(tabs)/content/index.tsx` using `tenantId` + `workspaceId`
- [x] T014 [US2] Implement content editor create/edit screen in `mobile/app/(tabs)/content/[id].tsx` (or `new.tsx`) saving via content-items API
- [x] T015 [US2] Add image pick + upload + attach flow with `expo-image-picker` in the content editor under `mobile/app/(tabs)/content/`
- [x] T016 [US2] Implement publish-now UI calling `POST /api/v1/content-ai/{id}/publish` and show per-destination results in the content editor
- [x] T017 [US2] Implement schedule controls (set future time, save scheduled status) in the content editor and block publish when no platforms/accounts selected

**Checkpoint**: US2 independently testable with a pre-connected account

---

## Phase 5: User Story 3 - Connect social accounts (Priority: P2)

**Goal**: OAuth connect/disconnect for workspace social destinations from mobile.

**Independent Test**: Start Facebook/Instagram/LinkedIn connect → complete consent → account listed; disconnect removes it from publish options.

### Implementation for User Story 3

- [x] T018 [P] [US3] Create Connections screen listing accounts in `mobile/app/(tabs)/connections.tsx` and register tab in `mobile/app/(tabs)/_layout.tsx`
- [x] T019 [US3] Implement OAuth start + deep-link/return handling for authorize URL in `mobile/app/(tabs)/connections.tsx` (and linking config in `mobile/app.json` / Expo Router as needed)
- [x] T020 [US3] Implement Facebook (and Instagram if required) page/account finalize sheets in `mobile/app/(tabs)/connections.tsx` mirroring web finalize APIs
- [x] T021 [US3] Implement disconnect action and refresh list in `mobile/app/(tabs)/connections.tsx`

**Checkpoint**: US3 independently testable

---

## Phase 6: User Story 4 - Reply from social inbox (Priority: P2)

**Goal**: View workspace conversations and send replies on mobile.

**Independent Test**: Open Inbox → see conversations → send reply → thread updates or clear error.

### Implementation for User Story 4

- [x] T022 [P] [US4] Create Inbox list screen in `mobile/app/(tabs)/inbox.tsx` and register tab in `mobile/app/(tabs)/_layout.tsx`
- [x] T023 [US4] Load conversations + optional sync via inbox APIs scoped to active workspace in `mobile/app/(tabs)/inbox.tsx`
- [x] T024 [US4] Implement conversation thread + reply composer (messages + reply endpoints) in `mobile/app/(tabs)/inbox/[id].tsx` or inline in `inbox.tsx`

**Checkpoint**: US4 independently testable with existing inbound messages

---

## Phase 7: User Story 5 - See today’s schedule (Priority: P3)

**Goal**: View upcoming scheduled posts and open allowed actions.

**Independent Test**: With scheduled items, Schedule tab shows time/status; open item to view / cancel / publish-now when allowed.

### Implementation for User Story 5

- [x] T025 [P] [US5] Create Schedule screen listing upcoming scheduled content in `mobile/app/(tabs)/schedule.tsx` and register tab in `mobile/app/(tabs)/_layout.tsx`
- [x] T026 [US5] Link schedule rows to content detail actions (view, cancel schedule, publish-now) reusing `mobile/app/(tabs)/content/` editor routes

**Checkpoint**: All user stories independently functional

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: UX, isolation, and quickstart validation across stories

- [x] T027 [P] Add simple offline/error banner component used on main tabs in `mobile/src/components/OfflineBanner.tsx` (or equivalent) and mount from `mobile/app/(tabs)/_layout.tsx`
- [x] T028 [P] Disable or hide publish/reply actions when role lacks permission (client UX) in content editor and inbox screens under `mobile/app/(tabs)/`
- [x] T029 Validate workspace switch clears/refetches Content, Inbox, and Schedule queries (keys include workspace id) across `mobile/app/(tabs)/`
- [x] T030 Run `specs/005-mobile-core-features/quickstart.md` scenarios 1–8 and note results

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS** all user stories
- **US1 (Phase 3)**: After Foundational — MVP reliability
- **US2 (Phase 4)**: After Foundational; publish needs connected accounts (can use web-preconnected accounts before US3)
- **US3 (Phase 5)**: After Foundational; unblocks real-device connect for US2/US4
- **US4 (Phase 6)**: After Foundational; better after US3 for live data
- **US5 (Phase 7)**: After US2 (reuses content schedule fields)
- **Polish (Phase 8)**: After desired stories complete

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories — **suggested MVP stop**
- **US2 (P1)**: Independent if accounts already connected; otherwise do US3 first for full demo
- **US3 (P2)**: Independent
- **US4 (P2)**: Independent with existing inbox data; US3 helps create traffic
- **US5 (P3)**: Depends on US2 schedule capability

### Parallel Opportunities

- T002 + T003 after T001
- T012 + T018 + T022 + T025 (screen stubs) once Foundational done — different files
- T027 + T028 in Polish

---

## Parallel Example: After Foundational

```bash
# Screen stubs in parallel:
Task: "T012 Content tab stubs in mobile/app/(tabs)/content/index.tsx"
Task: "T018 Connections screen in mobile/app/(tabs)/connections.tsx"
Task: "T022 Inbox screen in mobile/app/(tabs)/inbox.tsx"
Task: "T025 Schedule screen in mobile/app/(tabs)/schedule.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1–2
2. Complete Phase 3 (US1)
3. **STOP and VALIDATE** quickstart scenarios 1, 2, 8

### Incremental Delivery

1. US1 → reliable session
2. US3 → Connections (if device needs accounts)
3. US2 → Content publish/schedule
4. US4 → Inbox
5. US5 → Schedule tab
6. Polish → quickstart 1–8

---

## Notes

- [P] = different files, no incomplete dependencies
- [USn] maps to spec user stories
- No new `api-rust` modules planned — client of existing contracts only
- Avoid committing secrets; use `EXPO_PUBLIC_*` only

## Phase 9: Convergence

- [x] T031 Before publish in `mobile/src/components/ContentEditorScreen.tsx`, verify the active workspace has at least one connected social account (via `api.listSocialAccounts`) and block with guidance to open Connections when none exist per Edge Cases / FR-005 (partial)
- [x] T032 Derive real publish/reply permission from profile or membership data (not default `workspace.role === 'member'`) and apply it in `mobile/src/components/ContentEditorScreen.tsx` and `mobile/app/(tabs)/inbox/[id].tsx` per FR-012 (partial)
