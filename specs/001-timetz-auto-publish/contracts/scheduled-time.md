# Contract: scheduled_time / scheduledTime

## Database

| Column | Type | Nullable | Owner |
|--------|------|----------|-------|
| `content_items.scheduled_time` | `TIMETZ` | yes | Nest TypeORM migrations |

Rust SeaORM entities MUST decode/encode this column as TIMETZ-compatible (SQLx `PgTimeTz` or equivalent). Mapping as SQL `TIME` / plain `chrono::NaiveTime` is a **contract violation**.

## HTTP API (existing; no new routes)

Content create/update/list/detail under `/api/v1/...` (existing content-items routes).

| JSON field | Direction | Format | Semantics |
|------------|-----------|--------|-----------|
| `scheduledTime` | request | string `HH:mm` or `HH:mm:ss` (optional) | Wall-clock local schedule time |
| `scheduledTime` | response | string `HH:mm` or null | Wall-clock; timezone offset never returned as part of the string |

### Examples

```json
{ "scheduledTime": "14:30" }
```

```json
{ "scheduledTime": "09:05:00" }
```

```json
{ "scheduledTime": null }
```

## Scheduling semantics (Nest ↔ Rust)

Given `scheduledDate = 2026-07-23` and `scheduledTime = "14:30"` (or DB `14:30:00+02`):

- Due-at = local calendar `2026-07-23 14:30:00` (server local, wall-clock hours/minutes).
- Offset on TIMETZ MUST NOT shift the hours/minutes used for due checks.

## Auto-publish load path

`AutoPublishService::find_due_items` MUST successfully `SELECT` full content item rows including `scheduled_time` when values are non-null TIMETZ. Failure mode before fix (forbidden after fix):

```text
Query Error: ... decoding column "scheduled_time": mismatched types;
Rust type ... NaiveTime ... TIME is not compatible with SQL type TIMETZ
```

## Out of scope

- New public endpoints
- Changing column type away from `timetz`
- Changing client field names
