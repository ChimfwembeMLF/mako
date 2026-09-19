---
description: "Task list for Tenant Custom AI Keys"
---

# Tasks: Tenant Custom AI Keys & Usage Bypass

**Input**: Design documents from `/specs/013-tenant-custom-ai-keys/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Verify project compiles and runs cleanly before starting modifications

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T002 Update `api/src/modules/tenants/entities/tenants.entity.ts` to add `preferredAiProvider` column (Enum: `IntegrationProvider`).
- [ ] T003 Generate and apply TypeORM migration for adding `preferred_ai_provider` to the `tenants` table.
- [ ] T004 [P] Update `api-rust/src/entities/tenants.rs` to include `preferred_ai_provider` for Rust parity.
- [ ] T005 Create `AiProviderRouter` in `api/src/modules/ai/services/ai-provider-router.service.ts` implementing `complete` and `completeJson`.
- [ ] T006 Update `api/src/modules/ai/ai.module.ts` to export `AiProviderRouter`.
- [ ] T007 Update `api/src/modules/ai/services/ai-usage-tracker.service.ts` `assertWithinLimit` to accept a `bypassLimit: boolean` argument.

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Configure Custom AI Keys (Priority: P1) 🎯 MVP

**Goal**: Tenant administrators can configure their custom keys and select a preferred provider.

**Independent Test**: API keys can be entered, a preferred provider selected, and saved successfully.

### Implementation for User Story 1

- [ ] T008 [US1] Update UI components in `client/src/components/IntegrationSettings.tsx` to include a dropdown for "Preferred AI Provider" (reads/writes to tenant).
- [ ] T009 [US1] Update backend tenant settings update endpoint to allow saving `preferredAiProvider`.

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently.

---

## Phase 4: User Story 2 - System Routes to Custom AI Keys (Priority: P1)

**Goal**: System utilizes the tenant's preferred AI provider and custom API keys instead of platform global keys.

**Independent Test**: AI content generation correctly routes through `AiProviderRouter` using the tenant's keys and does not hit platform rate limits.

### Implementation for User Story 2

- [ ] T010 [P] [US2] In `api/src/modules/content_items/services/adapt-platforms.service.ts`, replace `MistralChatService` with `AiProviderRouter` and ensure `tenantId` is passed in all method options.
- [ ] T011 [P] [US2] In `api/src/modules/content_items/services/generate-content.service.ts`, replace `MistralChatService` with `AiProviderRouter` and ensure `tenantId` is passed in all method options.
- [ ] T012 [P] [US2] In `api/src/modules/content_items/services/repurpose-content.service.ts`, replace `MistralChatService` with `AiProviderRouter` and ensure `tenantId` is passed.
- [ ] T013 [P] [US2] Perform a global search and replace in `api/src/modules/ai/services/form-suggestions.service.ts`, `api/src/modules/content-publishing/comment-reply-ai.service.ts`, and other AI feature services to inject `AiProviderRouter` and pass `tenantId`.

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently.

---

## Phase 5: User Story 3 - Bypass Subscription AI Limits (Priority: P2)

**Goal**: Tenant AI usage is exempt from subscription limits when using custom keys.

**Independent Test**: Generation succeeds even if plan limits are exceeded, provided a custom key is used.

### Implementation for User Story 3

- [ ] T014 [US3] Update AI feature services to remove `assertWithinLimit` calls, OR update `AiProviderRouter` to determine if a custom key is present, and conditionally pass `bypassLimit = true` to `assertWithinLimit` (moving limit checks inside the Router).
- [ ] T015 [US3] Update usage recording calls to flag that a custom key was used (for analytics).

**Checkpoint**: All user stories should now be independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T016 Run quickstart.md validation scenarios.
- [ ] T017 Verify all Nest JS test suites pass (`npm run test`).
- [ ] T018 Verify Rust codebase compiles and tests pass (`cargo test`).

---

## Dependencies & Execution Order

- **Foundational**: MUST complete before any User Story.
- **US1 & US2**: Can run in parallel, though US2 requires US1 for end-to-end testing.
- **US3**: Depends on the routing abstraction from Foundational/US2.

## Parallel Example: User Story 2

```bash
# Launch all refactors for User Story 2 in parallel:
Task: "Update adapt-platforms.service.ts..."
Task: "Update generate-content.service.ts..."
Task: "Update repurpose-content.service.ts..."
```

## Implementation Strategy

### MVP First
1. Complete Foundational phase.
2. Implement US1 (Settings UI + Backend).
3. Implement US2 (Routing & Context Passing).
4. Validate End-to-End.
5. Proceed to US3 (Limit bypass).
