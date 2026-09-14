# Tasks: Google Drive Media Integration

**Input**: Design documents from `/specs/011-google-drive-media/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Verify `tenant_integration_configs` schema in `api/` and `api-rust/` supports Google Drive credentials
- [X] T002 Add `google_drive` source type to MediaItem enum in DB migrations and both APIs

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [X] T003 Setup Google API Client wrapper in NestJS (`api/src/modules/integrations/google-drive.service.ts`)
- [X] T004 [P] Setup Google API Client wrapper in Rust (`api-rust/src/modules/integrations/google_drive.rs`)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Connect Google Drive (Priority: P1) 🎯 MVP

**Goal**: Users can connect their Google Drive account to their workspace/tenant.

**Independent Test**: Can be tested by clicking "Connect Google Drive" in the Integrations settings and completing the OAuth flow.

### Implementation for User Story 1

- [ ] T005 [P] [US1] Implement Google OAuth initiation endpoint in NestJS (`api/src/modules/integrations/google-drive.controller.ts`)
- [ ] T006 [US1] Implement Google OAuth callback endpoint and credential storage in NestJS (`api/src/modules/integrations/google-drive.controller.ts`)
- [ ] T007 [P] [US1] Implement Google OAuth initiation endpoint in Rust (`api-rust/src/modules/integrations/google_drive_controller.rs`)
- [ ] T008 [US1] Implement Google OAuth callback endpoint and credential storage in Rust (`api-rust/src/modules/integrations/google_drive_controller.rs`)
- [ ] T009 [P] [US1] Add Google Drive to the Integrations UI in `client/src/components/IntegrationSettings.tsx`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Browse and Select Files from Google Drive (Priority: P1)

**Goal**: Users can browse their connected Google Drive from the media library and import files to Mako S3 storage.

**Independent Test**: Can be tested by opening the media library, selecting the Google Drive source, and importing a file.

### Implementation for User Story 2

- [ ] T010 [P] [US2] Implement `GET /api/v1/media/google-drive/files` endpoint in NestJS (`api/src/modules/media/google-drive.controller.ts`)
- [ ] T011 [US2] Implement `POST /api/v1/media/google-drive/import` endpoint in NestJS (streams to S3 and creates MediaItem)
- [ ] T012 [P] [US2] Implement `GET /api/v1/media/google-drive/files` endpoint in Rust (`api-rust/src/modules/media/google_drive_controller.rs`)
- [ ] T013 [US2] Implement `POST /api/v1/media/google-drive/import` endpoint in Rust
- [ ] T014 [US2] Add Google Drive tab to Media Library UI in `client/src/components/MediaLibrary.tsx` (calls list API)
- [ ] T015 [US2] Implement file selection and import action in Media Library UI (calls import API)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T016 Documentation updates for Google Drive integration
- [ ] T017 Code cleanup and refactoring
- [ ] T018 Run quickstart.md validation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Integrates with US1 (needs OAuth credentials)

### Within Each User Story

- Models before services
- Services before endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- Models within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Phase 6: Convergence

- [X] T019 [US1] Implement Google OAuth initiation and callback in NestJS per US1/FR-007 (missing)
- [X] T020 [US1] Implement Google OAuth initiation and callback in Rust per US1/FR-007 (missing)
- [X] T021 [US1] Add Google Drive connection button in `IntegrationSettings.tsx` per US1/FR-007 (missing)
- [X] T022 [US2] Implement Google Drive files list and import in NestJS per US2/FR-008 (missing)
- [X] T023 [US2] Implement Google Drive files list and import in Rust per US2/FR-008 (missing)
- [X] T024 [US2] Add Google Drive UI tab to `MediaLibrary.tsx` per US2/FR-008 (missing)

## Phase 7: Convergence

- [ ] T025 Add Google Drive UI tab and import functionality to `MediaLibraryPage.tsx` and `MediaPicker.tsx` per US2/FR-003 (missing)
