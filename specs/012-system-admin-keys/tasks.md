---
description: "Task list template for feature implementation"
---

# Tasks: System Admin Keys

**Input**: Design documents from `/specs/012-system-admin-keys/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Mako monorepo (default)**: `api-rust/src/`, `api/src/`, `client/src/`
- **Migrations**: `api/database/migrations/`
- **Deploy / env docs**: `docs/`, `docker-compose.yml`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create `PlatformIntegrationsService` inside `api/src/modules/system_settings/services/platform-integrations.service.ts` to encapsulate database read/writes for integration keys.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [x] T002 Implement encryption and decryption logic in `PlatformIntegrationsService` using `EncryptionService` to securely handle integration secrets at rest.
- [x] T003 Implement caching in `PlatformIntegrationsService` (e.g., in-memory map with TTL) to avoid DB hits on every request.

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Configure System API Keys (Priority: P1) 🎯 MVP

**Goal**: System Administrators need to configure global API keys directly from the admin dashboard.

**Independent Test**: Can be fully tested by logging in as a Super Admin, navigating to System Settings, and saving a new API key for a specific provider.

### Implementation for User Story 1

- [x] T004 [US1] Extend `SystemSettingsPage` in `client/src/pages/admin/SystemSettingsPage.tsx` to include a "Platform Integrations" tab.
- [x] T005 [P] [US1] Create a new form component `PlatformIntegrationsForm` in `client/src/components/admin/PlatformIntegrationsForm.tsx` to handle the inputs for OpenAI, Mistral, Google Drive, etc.
- [x] T006 [US1] Implement frontend API calls to fetch and save `platform_integrations` via `systemSettingsApi` in `client/src/lib/api.ts`.
- [x] T007 [US1] Create API endpoints in NestJS `api/src/modules/system_settings/system_settings.controller.ts` to support reading and updating `platform_integrations` using the new `PlatformIntegrationsService`.

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Application Fallback to Environment Variables (Priority: P1)

**Goal**: The application services need to read credentials from the database first, and if not present, fall back to the environment variables (.env).

**Independent Test**: Can be fully tested by removing a database key for a provider and observing that the service gracefully falls back to the .env key.

### Implementation for User Story 2 (NestJS)

- [x] T008 [P] [US2] Update `MistralChatService` in `api/src/modules/ai/services/mistral-chat.service.ts` to fetch its API key using `PlatformIntegrationsService` with fallback to `process.env`.
- [x] T009 [P] [US2] Update `OpenAiService` (if exists) in `api/src/modules/ai/services/openai.service.ts` to use fallback logic.
- [x] T010 [P] [US2] Update `GoogleDriveController` in `api/src/modules/media/google-drive.controller.ts` to fetch OAuth client ID/secret using the fallback logic.
- [x] T011 [P] [US2] Update any storage services (S3/Supabase) in `api/src/modules/storage/` to use fallback logic.

### Implementation for User Story 2 (Rust)

- [x] T012 [US2] Create or update `PlatformIntegrationsManager` in `api-rust/src/system_settings/` to load `platform_integrations` from the `system_settings` table and decrypt them.
- [x] T013 [P] [US2] Update Rust `MistralChatService` equivalent in `api-rust/src/modules/ai/mistral.rs` to fetch API key from the manager with fallback to `std::env::var`.
- [x] T014 [P] [US2] Update Rust Google Drive controller in `api-rust/src/modules/media/google_drive_controller.rs` to use fallback logic.

**Checkpoint**: At this point, both User Stories 1 and 2 should work independently and correctly handle fallback configurations.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T015 Run quickstart.md validation to ensure end-to-end fallback works seamlessly.
- [x] T016 Mask API keys in the frontend form (using password-type inputs or `***` masking) so they aren't exposed after saving.

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

- **User Story 1 (P1)**: Can start after Foundational (Phase 2)
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) and US1, as it requires the DB logic to be verified.

### Parallel Opportunities

- Updating the various NestJS and Rust integration services (T008-T014) can be done entirely in parallel by different developers.

---

## Implementation Strategy

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test UI and DB persistence independently.
3. Add User Story 2 (NestJS + Rust) → Test fallback behavior for each provider.
4. Polish and ship!

---

## Phase 6: Convergence

- [x] T017 Update `api/src/modules/auth/google-auth.service.ts` to use `PlatformIntegrationsService` fallback for Google credentials per FR-003 (missing)
- [x] T018 Update `api/src/modules/auth/strategies/google-stategy.ts` to use `PlatformIntegrationsService` fallback for Google credentials per FR-003 (missing)
- [x] T019 Update `api-rust/src/modules/auth/oauth/google.rs` to fetch Google OAuth client ID/secret dynamically with fallback per FR-003 (missing)
