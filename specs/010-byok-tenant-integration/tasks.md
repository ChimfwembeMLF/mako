# Tasks: BYOK Tenant Integration

**Input**: Design documents from `/specs/010-byok-tenant-integration/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/http.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure.

- [x] T001 Setup the database schema in NestJS TypeORM (generate migration) in `api/database/migrations/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 Implement `TenantIntegrationConfig` model/entity in NestJS `api/src/modules/tenants/entities/tenant-integration-config.entity.ts`
- [x] T003 [P] Implement `TenantIntegrationConfig` entity in Rust `api-rust/src/entities/tenant_integration_config.rs`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Store Custom API Keys (Priority: P1) 🎯 MVP

**Goal**: System MUST allow Tenant Administrators to securely store custom API keys for AI Providers (e.g., OpenAI, Gemini, Mistral, etc.) using AES-256-GCM.

**Independent Test**: Can create, read, and delete a tenant's integration config via REST API.

### Implementation for User Story 1

- [x] T004 [P] [US1] Implement `Aes256Gcm` encryption utilities in Rust `api-rust/src/common/encryption.rs`
- [x] T005 [P] [US1] Implement encryption service in NestJS `api/src/modules/tenants/services/encryption.service.ts`
- [x] T006 [P] [US1] Create HTTP DTOs in NestJS `api/src/modules/tenants/dto/tenant-integration-config.dto.ts`
- [x] T007 [US1] Implement `TenantIntegrationConfigsController` with CRUD routes in NestJS `api/src/modules/tenants/controllers/tenant-integration-configs.controller.ts` (depends on T005, T006)
- [x] T008 [US1] Implement HTTP routes for integration configs in Rust `api-rust/src/modules/tenants/integration_configs_handler.rs` (depends on T004)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Integration Fallback Logic (Priority: P2)

**Goal**: System MUST fallback to the platform's default AI Provider key if a tenant's custom key is invalid or runs out of quota, ensuring the feature never breaks for the user.

**Independent Test**: Mock a tenant integration key. Verify AI requests first attempt using the custom key and seamlessly fall back to the platform key upon failure.

### Implementation for User Story 2

- [x] T009 [US2] Update OpenAI/Gemini/Mistral LLM call wrappers in Rust to load custom key if available `api-rust/src/modules/ai/ai_service.rs`
- [x] T010 [P] [US2] Update LLM call wrapper in NestJS to load custom key if available `api/src/modules/ai/ai.service.ts`

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Client UI (Priority: P3)

**Goal**: Tenant Administrators MUST be able to manage their custom keys visually in the Mako settings area.

**Independent Test**: Open the web application and successfully configure an integration key without directly calling the backend APIs.

### Implementation for User Story 3

- [x] T011 [P] [US3] Add API client hook to fetch/update configs `client/src/hooks/api/useTenantIntegrationConfigs.ts`
- [x] T012 [US3] Create Integration Settings UI Component `client/src/features/tenants/components/IntegrationSettings.tsx` (depends on T011)
- [x] T013 [US3] Add Integration Settings route and tab in the Tenant Settings view `client/src/features/tenants/pages/TenantSettingsPage.tsx`

**Checkpoint**: All user stories should now be independently functional

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T014 Run quickstart.md validation
- [x] T015 [P] Audit logs: Ensure API key saving operations write to the `audit_logs` table (in both Rust and Nest)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed sequentially in priority order (P1 → P2 → P3) or in parallel if fully resourced.
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Depends on User Story 1 (Requires the encrypted keys to be available in the DB)
- **User Story 3 (P3)**: Depends on User Story 1 (Requires the REST API contracts to be implemented)

### Parallel Opportunities

- All Foundational tasks marked [P] can run in parallel (Rust and Nest entity scaffolding).
- Nest and Rust API routing implementation (Phase 3) can run in parallel by different developers.
- Nest and Rust AI fallback modifications (Phase 4) can run in parallel.
- The UI work (Phase 5) can theoretically start using mocked endpoints while Phase 3 finishes.
