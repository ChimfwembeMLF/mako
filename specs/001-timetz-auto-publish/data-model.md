# Data Model: 001-timetz-auto-publish

## Entities

### ContentItem (`content_items`)

Existing entity; this feature only corrects the mapping for `scheduled_time`.

| Field | DB type | Rust (target) | Notes |
|-------|---------|---------------|-------|
| id | uuid | Uuid | PK |
| tenant_id | uuid | Uuid | Tenancy |
| workspace_id | uuid | Uuid | Workspace scope |
| user_id | uuid | Uuid | Owner |
| status | text | Option\<String\> | `approved` / `scheduled` eligible for auto-publish |
| scheduled_date | date | Option\<Date\> | Calendar date; do not shift via ISO UTC |
| scheduled_time | **timetz** | Option\<**Timetz**\> | Wall-clock time; offset ignored for due checks |
| platforms | text[] | Option\<Vec\<String\>\> | Publish targets |
| publish_attempts | int | i32 | Cap via `MAX_PUBLISH_ATTEMPTS` |
| deleted_at | timestamptz | Option\<DateTimeWithTimeZone\> | Soft delete; auto-publish filters null |
| … | … | … | Other columns unchanged |

### Timetz (domain value)

| Attribute | Type | Rules |
|-----------|------|-------|
| wall_clock | NaiveTime | Hours/minutes (seconds optional); used by schedule due-at |
| storage_offset | FixedOffset (driver only) | Present in Postgres TIMETZ; **not** used for due calculation |

**Construction**

- From API string: parse `HH:mm` / `HH:mm:ss`; optional trailing offset stripped before parse.
- From DB: decode TIMETZ → take `.time` (NaiveTime) component of `PgTimeTz`.

**Validation**

- Empty / missing string → `None` (due check uses 00:00).
- Invalid format → `None` on write parse (existing behavior) or explicit API validation if already present.

## Relationships

- ContentItem belongs to Tenant / Workspace / User (unchanged).
- Auto-publish does not introduce new entities or join tables.

## State transitions (scheduling relevance)

```text
[draft|…] --approve/schedule--> approved|scheduled
approved|scheduled + due_at <= now + attempts < max --> publish attempt
published_at set / status published (existing publish service)
```

No new statuses. Fix unblocks transition into publish attempt by allowing row load.

## Nest parity

| Concern | Nest | Rust (after fix) |
|---------|------|------------------|
| Column | `timetz` | same column |
| Due time | `parseScheduledTimeParts` wall-clock | `scheduled_time_parts` wall-clock |
| API field | `scheduledTime` string | `scheduledTime` string via `format_scheduled_time` |
