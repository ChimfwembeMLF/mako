# Feature Specification: Fix TIMETZ scheduled_time decoding for auto-publish

**Feature Branch**: `001-timetz-auto-publish`

**Created**: 2026-07-23

**Status**: Draft

**Input**: User description: Production Rust auto-publish cron fails decoding `content_items.scheduled_time` — Rust `Option<NaiveTime>` / SQL `TIME` is not compatible with PostgreSQL `TIMETZ`. Logs show queue auto-publish failing then in-process publish also failing with the same Query Error.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Auto-publish due scheduled content (Priority: P1)

As an operator of Mako on the Rust production API, when content items are approved/scheduled with a date and time, the auto-publish cron must load those rows and publish due items without database decode errors.

**Why this priority**: Auto-publish is broken in production; scheduled posts never leave the queue/cron path.

**Independent Test**: With Redis queues on or off, run the auto-publish job against a DB that has at least one `content_items` row with non-null `scheduled_time` (timetz). The job completes without a TIMETZ decode error and attempts publish for due items.

**Acceptance Scenarios**:

1. **Given** a content item with status `approved` or `scheduled`, non-null `scheduled_date` / `scheduled_time` (PostgreSQL `timetz`), and due local wall-clock time, **When** the auto-publish cron runs, **Then** the query succeeds and the item is considered for publish (queued or in-process).
2. **Given** the same DB schema (`scheduled_time` remains `timetz`), **When** `ContentEntity::find()` loads items for auto-publish, **Then** no error of the form `Rust type … NaiveTime … TIME is not compatible with SQL type TIMETZ` is logged.

---

### User Story 2 - Create/update content with schedule time via API (Priority: P2)

As a tenant user, I can create or update content with a scheduled time string (`HH:mm` / `HH:mm:ss`) and later see that time reflected in list/detail responses, without breaking Nest-compatible wall-clock semantics.

**Why this priority**: Write/read paths share the same column mapping; fixing decode without breaking encode/API strings would regress content scheduling UI.

**Independent Test**: Create or update a content item with `scheduledTime`, reload it via GET, and confirm `scheduledTime` is returned as wall-clock `HH:mm` (offset stripped), matching Nest behavior.

**Acceptance Scenarios**:

1. **Given** an authenticated tenant user, **When** they set `scheduledTime` to `"14:30"` on a content item, **Then** the value persists and is returned as `"14:30"` (or equivalent wall-clock formatting) without TIMETZ decode failures on subsequent reads.
2. **Given** a DB value like `14:30:00+02`, **When** Rust loads the row, **Then** scheduling uses hours/minutes `14:30` (wall-clock), not a shifted UTC reinterpretation.

---

### User Story 3 - Observability when auto-publish runs cleanly (Priority: P3)

As an operator, after the fix I can confirm from logs that auto-publish either enqueues jobs or publishes in-process without falling back solely because of a decode error.

**Why this priority**: Confirms production health after deploy; secondary to the functional fix.

**Independent Test**: After deploy, inspect Rust logs for one auto-publish interval with due items present.

**Acceptance Scenarios**:

1. **Given** due items exist and queues are enabled, **When** the cron runs, **Then** logs show successful enqueue (or intentional empty) rather than repeated TIMETZ Query Errors.
2. **Given** queues are disabled, **When** the cron runs, **Then** in-process publish path runs without TIMETZ Query Errors.

---

### Edge Cases

- `scheduled_time` is NULL → item uses midnight (00:00) wall-clock for due checks, same as today / Nest.
- Values with offsets (`+02`, `-05`, `Z`) → only wall-clock hours/minutes used for due calculation.
- Malformed or unexpected driver representations → decode fails with a clear error for that row/query, not a silent wrong time.
- No schema migration required for the primary fix (column stays Nest `timetz`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST decode PostgreSQL `content_items.scheduled_time` (`TIMETZ`) into the Rust content item model without treating the column as SQL `TIME` / `NaiveTime`.
- **FR-002**: System MUST preserve Nest wall-clock semantics: due checks use local date + hours/minutes from the stored time, ignoring timezone offset for scheduling decisions.
- **FR-003**: Auto-publish (`AutoPublishService::find_due_items` and any path that loads full `content_items` rows including `scheduled_time`) MUST succeed when non-null `timetz` values are present.
- **FR-004**: Content create/update MUST continue accepting string schedule times and persisting them to `scheduled_time` without requiring a Nest-side schema change for this bugfix.
- **FR-005**: API responses that expose schedule time MUST continue returning a wall-clock time string (e.g. `HH:mm`) compatible with the client.
- **FR-006**: Live API behavior MUST be implemented in `api-rust` (production Dokploy `api` service).
- **FR-007**: No change to tenant/workspace isolation is required beyond existing content-item auth; auto-publish remains a system cron that processes due items across tenants as today.
- **FR-008**: Structured logs for auto-publish failures MUST remain; this fix MUST eliminate the recurring TIMETZ decode ERROR/WARN for normal rows.

### Key Entities

- **Content item**: Tenant-scoped scheduled post with `scheduled_date` (date), `scheduled_time` (timetz), `status`, `platforms`, publish attempt counters.
- **Schedule window**: Derived wall-clock due-at used by auto-publish to decide if an item is due.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Auto-publish cron completes a full cycle with ≥1 non-null `scheduled_time` row without TIMETZ/TIME decode errors.
- **SC-002**: Due approved/scheduled items are enqueued or published within one cron interval after becoming due (same operational expectation as Nest parity).
- **SC-003**: Content GET after create/update with `scheduledTime` returns wall-clock time without 5xx from decode failures.
- **SC-004**: Production logs over a 15-minute window show zero occurrences of `mismatched types` / `TIMETZ` for `scheduled_time`.

## Assumptions

- Schema ownership stays Nest TypeORM; `scheduled_time` remains `timetz` (no migration to `time` unless research proves encode/decode cannot be fixed in Rust alone).
- Production already runs Rust auto-publish cron; Nest workers must not also run auto-publish in the same environment.
- Wall-clock scheduling (server local) matches existing Nest `schedule.util.ts` behavior and is intentional.
- Existing `Timetz` newtype in `api-rust` is the right abstraction but its SeaORM/SQLx mapping is incomplete (`DeriveValueType` over `NaiveTime` still binds as `TIME`).
