---
description: "Task list for Mobile Core Hardening"
---

# Tasks: Mobile Core Hardening

**Input**: Design documents from `/specs/006-mobile-core-hardening/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Manual quickstart validation with recorded results (FR-014 / SC-006). No automated test tasks unless requested later.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Mobile app**: `mobile/app/`, `mobile/src/`
- **Live API**: `api-rust/src/modules/social_inbox/`
- **Contracts**: `specs/006-mobile-core-hardening/contracts/mobile-api.md`
- **QA**: `specs/006-mobile-core-hardening/quickstart.md`
- **Reference**: `client/src/components/replies/UnifiedSocialInbox.tsx`, `client/src/pages/PublisherConnect.tsx`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Ensure media dependency is installable and env docs match hardening rules

- [x] T001 Run yarn install / lock `expo-image-picker` for the `mobile` workspace so it appears in root `yarn.lock` and is resolvable from `mobile/package.json`
- [x] T002 [P] Update `mobile/.env.example` to document required `EXPO_PUBLIC_GOOGLE_*` (or project-standard Google public client keys) and state that dummy IDs must not be used
- [x] T003 [P] Remove or replace stub-only typing in `mobile/src/types/expo-image-picker.d.ts` once the real package types resolve

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared API client behaviors all stories need (reply outcome typing, refresh-aware upload)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Type `api.replyInbox` to return `{ sent: boolean; message?: string }` and add a small assert/helper for “sent must be true” in `mobile/src/lib/api.ts` per `contracts/mobile-api.md`
- [x] T005 Make `uploadMedia` in `mobile/src/lib/api.ts` follow the same 401 → refresh → retry → auth-failure path as `fetchWithAuth` (multipart-safe)
- [x] T006 [P] Extend `mobile/src/lib/api.ts` with comment-replies helpers (`inbox`, `fetch`, `send`) matching `contracts/mobile-api.md` / web `commentRepliesApi`

**Checkpoint**: Foundation ready — user story implementation can begin

---

## Phase 3: User Story 1 - Trustworthy replies and publishes (Priority: P1) 🎯 MVP

**Goal**: Soft-fail replies do not look successful; publish-now persists unsaved edits; publish blocked when selected destinations are not connected.

**Independent Test**: Force `{ sent: false }` → composer kept + error; edit existing draft text → Publish without Save → published body matches edit; select disconnected network → blocked with guidance.

### Implementation for User Story 1

- [x] T007 [US1] Enforce `sent === true` before clearing composer / implying success in `mobile/app/(tabs)/inbox/[id].tsx` (surface `message` on failure)
- [x] T008 [US1] Always save/update (and attach pending media) before `publishContent` for existing drafts in `mobile/src/components/ContentEditorScreen.tsx`
- [x] T009 [US1] Before publish in `mobile/src/components/ContentEditorScreen.tsx`, require selected platforms to intersect connected accounts from `api.listSocialAccounts` and guide user to Connections when not

**Checkpoint**: US1 fully testable — stop here for MVP trust demo if needed

---

## Phase 4: User Story 2 - Reliable media attach on device (Priority: P1)

**Goal**: Library permission + picker works; denied access explained; upload recovers via refresh.

**Independent Test**: Grant permission → attach image preview; deny permission → clear message; expired access with valid refresh → upload succeeds or clear sign-in.

### Implementation for User Story 2

- [x] T010 [US2] Request media library permission before `launchImageLibraryAsync` and show a clear denied-permission message in `mobile/src/components/ContentEditorScreen.tsx`
- [x] T011 [US2] Verify attach → save/publish path uses refresh-aware `uploadMedia` from T005 in `mobile/src/components/ContentEditorScreen.tsx` and surfaces offline/timeout/auth errors clearly

**Checkpoint**: Media attach happy path and denial UX work independently

---

## Phase 5: User Story 3 - Inbox parity for comments and messages (Priority: P2)

**Goal**: List and reply to post comments and DMs on mobile against live api-rust.

**Independent Test**: Workspace with comments + DMs → filter All/Comments/Messages → reply on comment thread with truthful success/failure.

### Implementation for User Story 3

- [x] T012 [US3] Extend `GET /api/v1/inbox/conversations` in `api-rust/src/modules/social_inbox/mod.rs` to emit `post_comment` rows (Nest `unified-inbox.service` parity) when `channel` is `all` or `post_comment`
- [x] T013 [US3] Add All / Comments / Messages channel filter and list both conversation types in `mobile/app/(tabs)/inbox/index.tsx` (call sync + comment fetch as needed)
- [x] T014 [US3] Load comment threads via comment-replies APIs and send replies with `sent` check in `mobile/app/(tabs)/inbox/[id].tsx` (or dedicated comment thread UI under `mobile/app/(tabs)/inbox/`)

**Checkpoint**: Comment + DM inbox independently testable on device against api-rust

---

## Phase 6: User Story 4 - Destinations match what’s connected (Priority: P2)

**Goal**: Editor destinations reflect connections; expand publisher OAuth toward web; no dummy Google client IDs.

**Independent Test**: Only Facebook connected → other chips disabled/hidden; connect YouTube (or TikTok/X/WhatsApp publisher) → listed; Google env unset → clear config error.

### Implementation for User Story 4

- [x] T015 [US4] Drive publish platform chips from connected accounts (disable/hide others with Connections guidance) in `mobile/src/components/ContentEditorScreen.tsx`
- [x] T016 [US4] Add YouTube / TikTok / Twitter / WhatsApp publisher connect entries and finalize sheets in `mobile/app/(tabs)/connections.tsx` mirroring web `PublisherConnect` (no WhatsApp hub/templates)
- [x] T017 [P] [US4] Wire YouTube/WhatsApp (and other) setup/finalize helpers in `mobile/src/lib/api.ts` per `contracts/mobile-api.md`
- [x] T018 [P] [US4] Remove dummy Google client ID fallbacks; disable Google CTA with clear config error when env missing in `mobile/app/(auth)/login.tsx` and `mobile/app/(auth)/signup.tsx`

**Checkpoint**: Destination alignment + expanded connect + Google config independently testable

---

## Phase 7: User Story 5 - Schedule and draft polish (Priority: P3)

**Goal**: Explicit cancel-schedule; show existing media; create/edit RBAC; recorded quickstart.

**Independent Test**: Cancel scheduled item → leaves schedule list; reopen draft with media → media visible; run quickstart results table.

### Implementation for User Story 5

- [x] T019 [US5] Add explicit Cancel schedule action (PATCH to draft + clear schedule fields) from `mobile/app/(tabs)/schedule.tsx` and/or `mobile/src/components/ContentEditorScreen.tsx`
- [x] T020 [US5] Render existing `item.media` when loading a draft in `mobile/src/components/ContentEditorScreen.tsx`
- [x] T021 [P] [US5] Gate create/edit (save/mutate) via `content.create` / `content.edit` in `mobile/src/hooks/useEffectivePermissions.ts` and apply in `mobile/src/components/ContentEditorScreen.tsx`
- [ ] T022 [US5] Run `specs/006-mobile-core-hardening/quickstart.md` scenarios 1–11 on a real device/simulator and fill the Results log (pass/fail)

**Checkpoint**: Polish + QA record complete for this story

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Isolation sanity and deferred-scope guardrails

- [x] T023 [P] Confirm Content / Inbox / Schedule / Connections query keys remain workspace-scoped after hardening changes under `mobile/app/(tabs)/`
- [x] T024 Verify FR-015 deferred modules were not added (no Approvals/Campaigns/Ads/Brand Brain/etc. screens) under `mobile/app/`
- [x] T025 [P] Note Nest–Rust inbox conversations parity fix in `api/docs/RUST_MIGRATION.md` if any temporary gap remains after T012

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS** all user stories
- **US1 (Phase 3)**: After Foundational — **MVP**
- **US2 (Phase 4)**: After Foundational; uses T005 upload path
- **US3 (Phase 5)**: After Foundational; needs T006 comment helpers + T012 Rust list
- **US4 (Phase 6)**: After Foundational; can parallelize with US3 if staffed (different files mostly)
- **US5 (Phase 7)**: After US1 recommended (editor/schedule reuse); QA last
- **Polish (Phase 8)**: After desired stories complete

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories — **suggested MVP stop**
- **US2 (P1)**: Independent of US1 (same editor file — serialize if one developer)
- **US3 (P2)**: Independent; needs Rust T012 before full comment list
- **US4 (P2)**: Independent of US3; overlaps editor chips with US1 T009 (extend, don’t regress)
- **US5 (P3)**: Builds on editor/schedule from prior stories

### Parallel Opportunities

- T002 / T003 after T001
- T004→T005→T006 carefully in same `api.ts` (T006 marked [P] only if batched after T004/T005)
- T017 / T018 parallel with connections UI prep
- US3 and US4 can proceed in parallel after Foundational if two developers

---

## Parallel Example: User Story 4

```bash
# API + auth in parallel:
Task: "Wire YouTube/WhatsApp setup/finalize helpers in mobile/src/lib/api.ts"
Task: "Remove dummy Google client IDs in mobile/app/(auth)/login.tsx and signup.tsx"
# Then connections UI:
Task: "Add connect entries + finalize sheets in mobile/app/(tabs)/connections.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1–2
2. Complete Phase 3 (US1)
3. **STOP and VALIDATE** quickstart scenarios 1–3 (reply soft-fail, reply success, save-before-publish)

### Incremental Delivery

1. US1 → trustworthy reply/publish
2. US2 → media attach reliability
3. US3 → comment inbox (+ Rust parity)
4. US4 → destinations + OAuth expand + Google config
5. US5 → schedule/media polish + recorded QA
6. Polish → isolation / deferred guard / migration note

### Parallel Team Strategy

1. Team completes Setup + Foundational
2. Dev A: US1 → US2 → US5 editor pieces
3. Dev B: US3 (Rust + inbox)
4. Dev C: US4 (connections + auth Google)
5. Someone runs T022 quickstart results log

---

## Notes

- [P] = different files, no incomplete dependencies
- [USn] maps to spec user stories
- Prefer `api-rust` for live inbox list parity; do not ship Nest-only
- Avoid committing secrets; use `EXPO_PUBLIC_*` only
- WhatsApp **hub/templates** out of scope; publisher connect OK

## Phase 9: Convergence

- [ ] T026 Execute `specs/006-mobile-core-hardening/quickstart.md` scenarios 1–11 on a real device or simulator and fill the Results log with pass/fail (completes open T022) per FR-014 / SC-006 (partial)
