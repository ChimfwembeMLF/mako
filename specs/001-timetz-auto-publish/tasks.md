---
description: "Task list for TIMETZ auto-publish decode fix"
---

# Tasks: Fix TIMETZ scheduled_time decoding for auto-publish

**Input**: Design documents from `/specs/001-timetz-auto-publish/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — plan/quickstart require unit tests for Timetz wall-clock parse and TIMETZ OID mapping (not full HTTP contract suite).

**Organization**: Tasks grouped by user story for independent implementation and validation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete work)
- **[Story]**: US1 / US2 / US3 maps to spec user stories
- Exact file paths included in every task

## Path Conventions

- Runtime fix: `api-rust/src/modules/content_items/`
- Auto-publish: `api-rust/src/modules/jobs/auto_publish.rs`
- Docs: `api/docs/RUST_MIGRATION.md`, `specs/001-timetz-auto-publish/`
- No Nest migration for primary path

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm branch and design artifacts before coding

- [x] T001 Confirm branch `001-timetz-auto-publish` and review `specs/001-timetz-auto-publish/plan.md`, `research.md`, and `contracts/scheduled-time.md`
- [x] T002 [P] Inventory current Timetz/SeaORM usage in `api-rust/src/modules/content_items/timetz.rs`, `entity.rs`, `schedule.rs`, and `api-rust/src/modules/jobs/auto_publish.rs`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Replace incorrect `DeriveValueType`/`NaiveTime`→`TIME` mapping so all stories can load/persist `scheduled_time`

**⚠️ CRITICAL**: No user story validation can succeed until Timetz encodes/decodes as PostgreSQL `TIMETZ`

- [x] T003 Replace `#[derive(DeriveValueType)]` on `Timetz` with custom SeaORM/SQLx TIMETZ value traits (decode via `PgTimeTz` or equivalent; encode as TIMETZ) in `api-rust/src/modules/content_items/timetz.rs`
- [x] T004 Ensure `ContentItems` model keeps `scheduled_time: Option<Timetz>` and SeaORM column metadata is TIMETZ-compatible in `api-rust/src/modules/content_items/entity.rs`
- [x] T005 Verify `cargo check -p api-rust` (or `cd api-rust && cargo check`) compiles after the Timetz trait changes

**Checkpoint**: Foundation ready — entity can bind `scheduled_time` as TIMETZ

---

## Phase 3: User Story 1 - Auto-publish due scheduled content (Priority: P1) 🎯 MVP

**Goal**: Auto-publish cron loads due `content_items` rows with non-null `timetz` `scheduled_time` without Query Error decode failures, then queues or publishes as today.

**Independent Test**: Against a DB with ≥1 non-null `scheduled_time` (`timetz`) and status `approved`/`scheduled`, run auto-publish (queues on or off). Job completes without `NaiveTime`/`TIME` vs `TIMETZ` mismatch; due items are considered for publish.

### Tests for User Story 1

- [x] T006 [P] [US1] Add unit tests for Timetz wall-clock extraction from offsetted strings (e.g. `14:30:00+02` → 14:30) in `api-rust/src/modules/content_items/timetz.rs` or `schedule.rs` `#[cfg(test)]` module
- [x] T007 [P] [US1] Add unit tests asserting SeaORM/SQLx value type for Timetz reports TIMETZ (not TIME) compatibility in `api-rust/src/modules/content_items/timetz.rs` `#[cfg(test)]`

### Implementation for User Story 1

- [x] T008 [US1] Confirm `is_content_due` / `scheduled_time_parts` still use wall-clock hours/minutes only (ignore offset) in `api-rust/src/modules/content_items/schedule.rs`
- [x] T009 [US1] Confirm `AutoPublishService::find_due_items` still uses `ContentEntity::find()` + filters and benefits from fixed decode in `api-rust/src/modules/jobs/auto_publish.rs` (adjust only if a cast/select workaround is still required after T003)
- [x] T010 [US1] Run `cd api-rust && cargo test` for Timetz/schedule tests and fix failures related to US1 decode/due logic
- [x] T011 [US1] Manually or via local API: trigger auto-publish load path against Postgres with non-null `timetz` and confirm no `mismatched types` / `TIMETZ` decode error in logs (per `specs/001-timetz-auto-publish/quickstart.md` scenario 2)

**Checkpoint**: US1 MVP — auto-publish can load and process due items

---

## Phase 4: User Story 2 - Create/update content with schedule time via API (Priority: P2)

**Goal**: Create/update with `scheduledTime` strings persists TIMETZ correctly and GET returns wall-clock `HH:mm` without decode failures or Nest semantic drift.

**Independent Test**: Create or PATCH content with `"scheduledTime": "14:30"`, GET the item, confirm `"scheduledTime": "14:30"` (or equivalent wall-clock) and DB value with offset still schedules as 14:30.

### Tests for User Story 2

- [x] T012 [P] [US2] Add unit tests for `parse_scheduled_time_str` / `format_scheduled_time` covering `HH:mm`, `HH:mm:ss`, offsetted DB-like strings, empty → None in `api-rust/src/modules/content_items/schedule.rs` `#[cfg(test)]`

### Implementation for User Story 2

- [x] T013 [US2] Verify create/update paths set `scheduled_time` via `parse_scheduled_time_str` and still compile/persist with new Timetz encode in `api-rust/src/modules/content_items/mod.rs`
- [x] T014 [P] [US2] Verify campaign/content helpers that call `parse_scheduled_time_str` remain correct in `api-rust/src/modules/content_campaigns/mod.rs`
- [x] T015 [US2] Verify list/detail serialization still emits `scheduledTime` via `format_scheduled_time` in `api-rust/src/modules/content_items/mod.rs` matching `specs/001-timetz-auto-publish/contracts/scheduled-time.md`
- [x] T016 [US2] Run `cd api-rust && cargo test` for schedule/format tests; optionally smoke create→GET with `scheduledTime` per quickstart scenario 3

**Checkpoint**: US1 + US2 — read/write schedule API and auto-publish load both work

---

## Phase 5: User Story 3 - Observability when auto-publish runs cleanly (Priority: P3)

**Goal**: Operators can confirm from logs that auto-publish succeeds (enqueue or in-process) without recurring TIMETZ decode WARN/ERROR.

**Independent Test**: After deploy (or local cron), one auto-publish interval with due items shows enqueue/publish success paths and zero `mismatched types` / `scheduled_time` TIMETZ decode errors.

### Implementation for User Story 3

- [x] T017 [US3] Review auto-publish WARN/ERROR log messages in `api-rust/src/modules/jobs/auto_publish.rs` and `api-rust/src/modules/jobs/mod.rs` so decode failures remain distinguishable from real publish failures (adjust message wording only if needed)
- [x] T018 [US3] Document post-deploy log check (zero TIMETZ decode errors over ~15 minutes) in `specs/001-timetz-auto-publish/quickstart.md` if any step needs tightening after implementation
- [x] T019 [US3] After Dokploy rebuild/redeploy of Rust `api`, verify one cron interval against production/staging logs for SC-004 (no secrets in notes)

**Checkpoint**: All stories independently verifiable; production health observable

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Docs and final validation across stories

- [x] T020 [P] Add a short note under Nest–Rust parity / known fixes in `api/docs/RUST_MIGRATION.md` that `scheduled_time` TIMETZ is handled via custom Timetz/`PgTimeTz` in Rust (no schema change)
- [x] T021 Run full validation from `specs/001-timetz-auto-publish/quickstart.md` (unit tests + load path; API smoke if credentials available)
- [x] T022 Confirm no Nest migration was added under `api/database/migrations/` for this bugfix and Dokploy impact is rebuild `api` image only

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS** all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational — MVP
- **User Story 2 (Phase 4)**: Depends on Foundational; shares Timetz encode with US1 (prefer after T003–T005)
- **User Story 3 (Phase 5)**: Depends on US1 being deployable; log verification after US1 fix is live
- **Polish (Phase 6)**: After desired stories complete

### User Story Dependencies

- **US1 (P1)**: After Phase 2 only — no dependency on US2/US3
- **US2 (P2)**: After Phase 2; encode path must match T003; independently testable via create/GET
- **US3 (P3)**: After US1 behavior is fixed in a running environment; does not change decode logic

### Within Each User Story

- Unit tests (T006/T007/T012) can be written alongside or just after Timetz traits; they must pass before story checkpoint
- US1: traits → due-check confirm → cargo test → DB load path
- US2: parse/format tests → CRUD serialization verify → cargo test / smoke
- US3: log review → quickstart note → post-deploy check

### Parallel Opportunities

- T001 then T002; T002 is [P] with doc skim
- After T003: T006 and T007 can run in parallel
- After Phase 2: US2 tasks T012–T015 can proceed in parallel with late US1 validation (T011) if staffed
- T014 [P] vs T013 if campaign module vs content_items/mod edits do not conflict
- T020 [P] docs can run alongside T021 once code is stable

---

## Parallel Example: User Story 1

```bash
# After T003–T005 foundation:
Task: "Add unit tests for Timetz wall-clock extraction in api-rust/src/modules/content_items/timetz.rs or schedule.rs"
Task: "Add unit tests asserting TIMETZ (not TIME) value type in api-rust/src/modules/content_items/timetz.rs"

# Then sequentially:
Task: "Confirm schedule wall-clock due logic in api-rust/src/modules/content_items/schedule.rs"
Task: "Confirm auto_publish find_due_items in api-rust/src/modules/jobs/auto_publish.rs"
Task: "cargo test + quickstart load-path validation"
```

---

## Parallel Example: User Story 2

```bash
Task: "Unit tests for parse/format in api-rust/src/modules/content_items/schedule.rs"
Task: "Verify campaign parse_scheduled_time_str usage in api-rust/src/modules/content_campaigns/mod.rs"
# Then content_items mod create/update + serialization checks
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup  
2. Complete Phase 2: Foundational Timetz TIMETZ mapping (**critical**)  
3. Complete Phase 3: US1 tests + auto-publish load path  
4. **STOP and VALIDATE**: auto-publish against DB with non-null `timetz`  
5. Redeploy Rust `api` if MVP is enough to unblock production  

### Incremental Delivery

1. Setup + Foundational → TIMETZ mapping compiles  
2. US1 → Auto-publish unblocked (MVP)  
3. US2 → Create/update/GET schedule strings verified  
4. US3 → Log/ops confirmation post-deploy  
5. Polish → RUST_MIGRATION note + quickstart full pass  

### Parallel Team Strategy

1. One developer owns T003–T005 (Timetz traits)  
2. After foundation: Dev A finishes US1 validation; Dev B does US2 parse/format + API serialization  
3. US3 + polish after deploy  

---

## Notes

- [P] = different files / no incomplete-task dependency  
- Do **not** migrate `timetz` → `time` unless T003 proves impossible (research rejected for P1)  
- Do **not** enable Nest + Rust auto-publish workers in the same environment  
- No secrets in specs, tasks, or migration notes  
- Commit after each logical group if the user requests commits  

---

## Task Summary

| Phase | Tasks | Count |
|-------|-------|-------|
| Setup | T001–T002 | 2 |
| Foundational | T003–T005 | 3 |
| US1 (P1 MVP) | T006–T011 | 6 |
| US2 (P2) | T012–T016 | 5 |
| US3 (P3) | T017–T019 | 3 |
| Polish | T020–T022 | 3 |
| **Total** | T001–T022 | **22** |
