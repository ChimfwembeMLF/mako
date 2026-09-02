---
description: "Task list for Mobile UI Parity & Missing Components"
---

# Tasks: Mobile UI Parity & Missing Components

**Input**: Design documents from `/specs/007-mobile-ui-parity/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Manual device quickstart with recorded results (SC-007). No automated test tasks unless requested later.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Maps to spec user stories US1–US5
- Include exact file paths in descriptions

## Path Conventions

- **Mobile app**: `mobile/app/`, `mobile/src/`
- **Contracts**: `specs/007-mobile-ui-parity/contracts/mobile-api.md`, `contracts/ui-shell.md`
- **QA**: `specs/007-mobile-ui-parity/quickstart.md`
- **Reference**: `client/src/lib/nav-config.ts`, `client/src/lib/api.ts`, `DESIGN.md`

**Note**: Some P1 UI work may already exist on branch (fonts, base `ui/` components, calendar, bubbles). Tasks below complete gaps and verify parity per `contracts/ui-shell.md`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies and nav/API scaffolding for parity work

- [X] T001 Add `@expo-google-fonts/inter` and `@expo-google-fonts/manrope` to `mobile/package.json` and ensure root `yarn.lock` resolves them
- [X] T002 [P] Create `mobile/src/constants/mobile-nav.ts` mirroring web `SOCIAL_NAV_GROUPS` + permission-filtered `MORE_ITEMS` subset per `research.md` R1
- [X] T003 [P] Extend `mobile/.env.example` with any new public env keys documented in `specs/007-mobile-ui-parity/contracts/mobile-api.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: App shell infrastructure all user stories depend on

**⚠️ CRITICAL**: No user story work should begin until this phase is complete

- [X] T004 Wire `useAppFonts` + splash hide in `mobile/app/_layout.tsx` and export font families from `mobile/src/theme.ts`
- [X] T005 [P] Add dark palette tokens to `mobile/src/theme.ts` and create `mobile/src/context/ThemeContext.tsx` (light/dark toggle + persistence)
- [X] T006 Wrap app with `ThemeProvider` in `mobile/app/_layout.tsx` and consume tokens in `mobile/src/components/ui/*`
- [X] T007 [P] Implement `Toast` + `ToastProvider` in `mobile/src/components/ui/Toast.tsx` and export from `mobile/src/components/ui/index.ts`
- [X] T008 [P] Implement `EmptyState` in `mobile/src/components/ui/EmptyState.tsx` and export from `mobile/src/components/ui/index.ts`
- [X] T009 [P] Implement `Skeleton` list placeholder in `mobile/src/components/ui/Skeleton.tsx` and export from `mobile/src/components/ui/index.ts`
- [X] T010 Implement `Sheet` bottom modal in `mobile/src/components/ui/Sheet.tsx` for workspace switcher and pickers
- [X] T011 Extend `mobile/src/hooks/useEffectivePermissions.ts` with keys from `contracts/ui-shell.md` / web `P.*` (settings, team, approvals, brand brain)
- [X] T012 Create `mobile/src/components/AppShellHeader.tsx` with workspace name + tap-to-switch via `Sheet` and `api.getWorkspaces`

**Checkpoint**: Foundation ready — user story phases can begin

---

## Phase 3: User Story 1 - Web-consistent shell & design system (Priority: P1) 🎯 MVP

**Goal**: Shared Wise-inspired UI, More navigation, workspace switcher in shell, toasts on core actions.

**Independent Test**: Audit six core tabs per quickstart Scenario 1; workspace switch without Home-only picker (Scenario 2); toast on save failure (Scenario 3).

### Implementation for User Story 1

- [X] T013 [US1] Add `ToastProvider` to root layout in `mobile/app/_layout.tsx` and replace critical `Alert.alert` success/error paths with toasts in content/inbox/connections flows
- [X] T014 [US1] Add **More** tab and stack group `mobile/app/(tabs)/more/_layout.tsx` + `mobile/app/(tabs)/more/index.tsx` listing permission-filtered destinations from `mobile/src/constants/mobile-nav.ts`
- [X] T015 [US1] Integrate `AppShellHeader` into tab stacks via `mobile/app/(tabs)/_layout.tsx` or per-stack `_layout.tsx` files (content, inbox, more)
- [X] T016 [P] [US1] Refactor `mobile/app/(tabs)/index.tsx` to social dashboard (keep hero + quick links); remove workspace picker as sole Home purpose
- [X] T017 [P] [US1] Audit and align `mobile/app/(tabs)/content/index.tsx` to `PageHeader` + `EmptyState` per `contracts/ui-shell.md`
- [X] T018 [P] [US1] Audit and align `mobile/app/(tabs)/connections.tsx` to shell contract (header, empty state, toast on connect/disconnect)
- [X] T019 [P] [US1] Audit and align `mobile/app/(tabs)/inbox/index.tsx` to shell contract
- [X] T020 [P] [US1] Audit and align `mobile/app/(tabs)/schedule.tsx` to shell contract
- [X] T021 [P] [US1] Audit and align `mobile/app/(tabs)/profile.tsx` to shell contract
- [x] T022 [P] [US1] Audit and align `mobile/app/(auth)/login.tsx` and `mobile/app/(auth)/signup.tsx` to auth screen contract in `contracts/ui-shell.md`
- [X] T023 [US1] Add `LockedNavItem` row variant in `mobile/app/(tabs)/more/index.tsx` for permission-denied destinations (no crash, clear copy)

**Checkpoint**: US1 shell audit passes Scenario 1–3 on simulator

---

## Phase 4: User Story 2 - Complete core social workflows (Priority: P1)

**Goal**: Calendar/list scheduler, inbox bubbles, connections branding, editor polish with toast feedback.

**Independent Test**: quickstart Scenario 4 (draft → schedule → calendar → inbox reply) without web.

### Implementation for User Story 2

- [X] T024 [US2] Verify/finish `mobile/src/components/ScheduleCalendar.tsx` (month nav, day chips, platform colors) against `contracts/ui-shell.md`
- [X] T025 [US2] Wire calendar/list toggle + due-today/overdue stats in `mobile/app/(tabs)/schedule.tsx`; toast on cancel-schedule success/failure
- [X] T026 [US2] Verify/finish `mobile/src/components/ui/MessageBubble.tsx` and thread layout in `mobile/app/(tabs)/inbox/[id].tsx` (DM inbound/outbound, comment select)
- [X] T027 [US2] Replace inbox composer `Alert` paths with toasts; keep `assertReplySent` behavior in `mobile/app/(tabs)/inbox/[id].tsx`
- [X] T028 [US2] Verify platform-branded cards in `mobile/app/(tabs)/connections.tsx` use `mobile/src/constants/platforms.ts` and toast on OAuth finalize errors
- [X] T029 [US2] Audit `mobile/src/components/ContentEditorScreen.tsx` for shell buttons/chips; toast on save/publish outcomes
- [X] T030 [US2] Add `Skeleton` loading states to content list, inbox list, and schedule list screens (replace spinner-only where lists expected)

**Checkpoint**: US2 core workflow passes Scenario 4

---

## Phase 5: User Story 3 - Missing social product surfaces (Priority: P2)

**Goal**: Brand Brain, Media, Templates, Campaigns, Analytics snapshot, Settings reachable from More.

**Independent Test**: quickstart Scenario 5 — at least six P2 destinations reachable with minimal read/edit action.

### Implementation for User Story 3

- [X] T031 [P] [US3] Add brand profile API helpers (`getMine`, `update`) to `mobile/src/lib/api.ts` per `contracts/mobile-api.md`
- [X] T032 [P] [US3] Add media list API helper to `mobile/src/lib/api.ts`
- [X] T033 [P] [US3] Add templates list/get API helpers to `mobile/src/lib/api.ts`
- [X] T034 [P] [US3] Add campaigns list/get API helpers to `mobile/src/lib/api.ts`
- [X] T035 [P] [US3] Add analytics platform-dashboard API helper to `mobile/src/lib/api.ts`
- [X] T036 [US3] Implement `mobile/app/(tabs)/more/brand-brain.tsx` — view/edit core fields with `PageHeader`, save toast, empty setup prompt
- [X] T037 [US3] Implement `mobile/app/(tabs)/more/media.tsx` — library list with `Skeleton`/`EmptyState`; tap to copy URL or return selection via params
- [X] T038 [US3] Implement `mobile/app/(tabs)/more/templates.tsx` — list templates; apply selected template to new draft via `mobile/app/(tabs)/content/new.tsx` params
- [X] T039 [US3] Implement `mobile/app/(tabs)/more/campaigns.tsx` — read-only list + detail sheet
- [X] T040 [US3] Implement `mobile/app/(tabs)/more/analytics.tsx` — snapshot metric cards from platform-dashboard API
- [X] T041 [US3] Implement `mobile/app/(tabs)/more/settings.tsx` — account summary from `api.getProfile`; link to theme toggle if applicable
- [x] T042 [US3] Add media library pick `Sheet` in `mobile/src/components/ContentEditorScreen.tsx` (attach from library, not only device roll)
- [x] T043 [US3] Document any Rust 404 gaps discovered in `api/docs/RUST_MIGRATION.md` with mobile route reference

**Checkpoint**: US3 — Scenario 5 count ≥ 6 destinations on device

---

## Phase 6: User Story 4 - Engagement, team & governance (Priority: P3)

**Goal**: Team, Approvals, Leads, Mail summary, WhatsApp status, auto-reply rules from More.

**Independent Test**: quickstart Scenario 10–11 with role-appropriate user; lists load or show locked/empty state.

### Implementation for User Story 4

- [x] T044 [P] [US4] Add team/tenant-members list API helper to `mobile/src/lib/api.ts`
- [x] T045 [P] [US4] Add approval-requests list + patch API helpers to `mobile/src/lib/api.ts`
- [x] T046 [P] [US4] Add leads list/get API helpers to `mobile/src/lib/api.ts`
- [x] T047 [P] [US4] Add mail gmail status + inbox summary API helpers to `mobile/src/lib/api.ts`
- [x] T048 [P] [US4] Add whatsapp status/summary + auto-reply-rules list/patch API helpers to `mobile/src/lib/api.ts`
- [x] T049 [US4] Implement `mobile/app/(tabs)/more/team.tsx` — member roster with role badges
- [x] T050 [US4] Implement `mobile/app/(tabs)/more/approvals.tsx` — pending list; approve/reject when permitted
- [x] T051 [US4] Implement `mobile/app/(tabs)/more/leads.tsx` — list + detail read
- [x] T052 [US4] Implement `mobile/app/(tabs)/more/mail.tsx` — Gmail status + inbox thread summaries (read-first)
- [x] T053 [US4] Implement `mobile/app/(tabs)/more/whatsapp.tsx` — connection health + links to unified inbox
- [x] T054 [US4] Implement `mobile/app/(tabs)/more/auto-reply-rules.tsx` — list rules; toggle enabled when permitted

**Checkpoint**: US4 — Scenario 11 optional surfaces pass or show clear empty/locked UX

---

## Phase 7: User Story 5 - Auth, onboarding & dark theme (Priority: P3)

**Goal**: Forgot password, onboarding hint, dark mode legibility.

**Independent Test**: quickstart Scenarios 7–9.

### Implementation for User Story 5

- [x] T055 [US5] Add `forgotPassword` API helper to `mobile/src/lib/api.ts` (`POST /api/v1/auth/forgot-password`)
- [x] T056 [US5] Create `mobile/app/(auth)/forgot-password.tsx` and link from `mobile/app/(auth)/login.tsx`
- [x] T057 [US5] Create `mobile/src/components/OnboardingHint.tsx` and show dismissible hint on `mobile/app/(tabs)/index.tsx` (persist dismiss in SecureStore)
- [x] T058 [US5] Apply dark tokens across core tabs and More screens; verify contrast on `mobile/app/(tabs)/*` and `mobile/app/(tabs)/more/*`
- [x] T059 [US5] Add theme toggle entry in `mobile/app/(tabs)/more/settings.tsx` when tenant/user theme not auto-driven

**Checkpoint**: US5 — Scenarios 7–9 pass on device

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Tablet inbox split, API CORS for Expo web dev, QA sign-off

- [x] T060 [P] Optional tablet master-detail inbox in `mobile/app/(tabs)/inbox/` when width ≥ 768 (`useWindowDimensions`)
- [x] T061 [P] Confirm Expo web dev CORS includes port 8081 in `api/src/common/cors.util.ts` (document in `specs/007-mobile-ui-parity/research.md` if already done)
- [x] T062 Run full `specs/007-mobile-ui-parity/quickstart.md` Scenarios 1–10 on device/simulator and record Results log in quickstart.md
- [x] T063 [P] Export any new public components from `mobile/src/components/ui/index.ts` and remove duplicate StyleSheet patterns superseded by shared UI

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **blocks all user stories**
- **US1 (Phase 3)**: Depends on Phase 2 — MVP shell
- **US2 (Phase 4)**: Depends on Phase 2; benefits from US1 toasts/shell but independently testable via Scenario 4
- **US3 (Phase 5)**: Depends on Phase 2 + More tab from US1 (T014)
- **US4 (Phase 6)**: Depends on Phase 2 + More tab from US1
- **US5 (Phase 7)**: Depends on Phase 2; settings screen from US3 (T041) before T059 theme toggle
- **Polish (Phase 8)**: Depends on desired user stories complete

### User Story Dependencies

| Story | Depends on | Independent test |
|-------|------------|------------------|
| US1 | Foundational | Shell audit Scenarios 1–3 |
| US2 | Foundational (+ US1 toasts recommended) | Scenario 4 |
| US3 | Foundational, More tab (T014) | Scenario 5 |
| US4 | Foundational, More tab (T014) | Scenarios 10–11 |
| US5 | Foundational, Settings (T041) for theme toggle | Scenarios 7–9 |

### Parallel Opportunities

- **Phase 1**: T002, T003 in parallel after T001
- **Phase 2**: T005, T007, T008, T009 in parallel after T004
- **US1**: T016–T022 audit tasks in parallel after T014–T015
- **US3**: T031–T035 API helpers in parallel; T036–T041 screens in parallel after helpers
- **US4**: T044–T048 API helpers in parallel; T049–T054 screens in parallel after helpers

---

## Parallel Example: User Story 3

```bash
# API helpers together:
T031 brand profiles → mobile/src/lib/api.ts
T032 media list → mobile/src/lib/api.ts
T033 templates → mobile/src/lib/api.ts
T034 campaigns → mobile/src/lib/api.ts
T035 analytics → mobile/src/lib/api.ts

# Screens together (after helpers):
T036 brand-brain.tsx
T037 media.tsx
T038 templates.tsx
T039 campaigns.tsx
T040 analytics.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1–2 (Setup + Foundational)
2. Complete Phase 3 (US1 shell + More tab + audits)
3. **STOP and VALIDATE**: quickstart Scenarios 1–3
4. Demo recognizable web parity on core navigation

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → shell MVP
3. US2 → core workflows hardened
4. US3 → P2 product surfaces (SC-003 ≥ 8 destinations with US4 partial)
5. US4 + US5 → ops + auth polish
6. Phase 8 → recorded QA sign-off

### Suggested MVP scope

**Phases 1–3 (T001–T023)** — design system, More menu, workspace switcher, six-tab shell audit.

---

## Notes

- Do not scope Ads, chatbot authoring, billing checkout, super-admin, export, push, or drag-drop reschedule (FR-016).
- If `api-rust` returns 404 for a contracted route, follow T043 protocol before marking US3/US4 tasks complete.
- Prefer extending existing `mobile/src/components/ui/*` over new one-off StyleSheets.

---

## Task Summary

| Phase | Tasks | Story |
|-------|-------|-------|
| 1 Setup | T001–T003 | — |
| 2 Foundational | T004–T012 | — |
| 3 US1 Shell | T013–T023 | US1 |
| 4 US2 Core | T024–T030 | US2 |
| 5 US3 Surfaces | T031–T043 | US3 |
| 6 US4 Engagement | T044–T054 | US4 |
| 7 US5 Auth/polish | T055–T059 | US5 |
| 8 Polish | T060–T063 | — |

**Total tasks**: 63  
**Parallel-friendly**: 28 marked [P]  
**MVP**: Phases 1–3 (23 tasks)
