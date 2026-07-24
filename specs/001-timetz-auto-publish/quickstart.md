# Quickstart: Validate TIMETZ auto-publish fix

## Prerequisites

- Repo checkout on branch `001-timetz-auto-publish` (or equivalent with the Timetz mapping fix applied)
- Rust toolchain for `api-rust/`
- Optional: Postgres with `content_items.scheduled_time` as `timetz` and at least one non-null value
- Production/Dokploy: only Rust owns auto-publish cron/queues

## Setup

```bash
cd api-rust
cargo test timetz
cargo test schedule::tests
```

(`api-rust` is a binary crate — use `cargo test <filter>`, not `cargo test --lib`.)

If validating against a real DB, ensure `DATABASE_URL` points at an environment whose schema matches Nest migrations (`scheduled_time timetz`).

## Validation scenarios

### 1. Unit: wall-clock parse / TIMETZ strip

Run the Timetz / schedule unit tests. Expected:

- `"14:30"` → hours 14, minutes 30
- `"14:30:00+02"` → hours 14, minutes 30 (offset ignored)
- `ValueType::column_type()` is custom `TIMETZ` (not `TIME`)
- `Value::from(Timetz)` is TIMETZ text (`14:30:00+00`), not `ChronoTime`

### 2. Load path: SeaORM find with non-null scheduled_time

With DB access:

1. Confirm column type: `\d content_items` → `scheduled_time | time with time zone`
2. Ensure ≥1 row with non-null `scheduled_time` and status `approved` or `scheduled`
3. Start API (or wait for one auto-publish cron tick with `AUTO_PUBLISH_CRON_ENABLED=true`)
4. Expected: **no** log line containing `mismatched types` + `TIMETZ` + `scheduled_time`
5. Expected: due items enqueued or published per [contracts/scheduled-time.md](./contracts/scheduled-time.md)

### 3. API smoke (optional)

1. Authenticate as a tenant user
2. Create or PATCH a content item with `"scheduledTime": "14:30"`
3. GET the item
4. Expected: `"scheduledTime": "14:30"` (or `HH:mm` equivalent), HTTP 200

### 4. Production post-deploy (SC-004)

1. Rebuild/redeploy Dokploy Rust `api` image only (no Nest migration, no env change)
2. Watch logs for **≥15 minutes** / several auto-publish intervals (~5 min each)
3. Grep / filter for the old failure — expected **zero** hits:

   ```text
   mismatched types
   scheduled_time
   TIMETZ
   ```

4. Healthy signs: `Auto-publish cron complete` with `attempted`/`queued`, or silence when nothing is due — **not** repeated `Auto-publish cron failed (query load or publish)` with TIMETZ Query Errors
5. Confirm Nest auto-publish workers remain **off** in that environment

## References

- [data-model.md](./data-model.md)
- [contracts/scheduled-time.md](./contracts/scheduled-time.md)
- [research.md](./research.md)

## Non-goals for this quickstart

- Full social publish to Meta/X
- Nest migration run
- Enabling Nest workers alongside Rust
