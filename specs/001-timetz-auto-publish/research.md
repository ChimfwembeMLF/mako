# Research: 001-timetz-auto-publish

## R1 — Root cause of production decode error

**Decision**: Treat the failure as a SeaORM/SQLx type OID mismatch, not a cron logic bug.

**Rationale**: Logs show:

```text
decoding column "scheduled_time": mismatched types;
Rust type `Option<NaiveTime>` (as SQL type `TIME`) is not compatible with SQL type `TIMETZ`
```

Nest entity uses `@Column({ type: 'timetz', nullable: true })`. Rust entity uses `Option<Timetz>` where `Timetz` wraps `NaiveTime` with `#[derive(DeriveValueType)]` and `column_type = "custom(\"TIMETZ\")"`. `DeriveValueType` still implements decode via the **inner** type (`NaiveTime` → SQL `TIME`). SQLx rejects reading a `TIMETZ` OID into a `TIME`-typed decoder. Auto-publish calls `ContentEntity::find().all()`, so every cron tick fails when any loaded row has a non-null `scheduled_time` (or possibly even when the driver prepares the column type for the result set).

**Alternatives considered**:

- Blame Redis queue dispatch — rejected; in-process fallback hits the same `find_due_items` query.
- Blame schedule due-check logic — rejected; failure happens at decode before `is_content_due`.

## R2 — Correct Rust representation for PostgreSQL TIMETZ

**Decision**: Keep a domain `Timetz` newtype holding wall-clock `NaiveTime`, but implement SeaORM value traits by decoding through SQLx `PgTimeTz<NaiveTime, FixedOffset>` (or manual `TryGetable` that accepts TIMETZ and strips offset). Encode writes as TIMETZ (typically offset `+00` or server-local fixed offset) while Nest/API continue to speak wall-clock strings.

**Rationale**: SQLx documents `PgTimeTz` as the Rust type for Postgres `TIMETZ`. Nest already strips offset with a regex on hours/minutes for due checks (`parseScheduledTimeParts`). Rust `schedule.rs` already documents the same wall-clock rule. Domain code should keep using hours/minutes only.

**Alternatives considered**:

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Migrate column `timetz` → `time` | NaiveTime works out of the box | Nest migration + data rewrite; Nest/TypeORM still typed as timetz historically; wider blast radius | Reject for P1 |
| Cast in every query: `scheduled_time::time` | Quick | Easy to miss a query; entity still wrong for default finds | Reject as primary |
| Store as `String` / text in entity | Avoids type OID | Loses type safety; worse encode | Reject |
| Custom `Timetz` + `PgTimeTz` bridge | Localized fix; keeps Nest schema | Slightly more trait boilerplate than DeriveValueType | **Accept** |

## R3 — Encode path for create/update

**Decision**: When persisting API `scheduledTime` strings, parse to wall-clock `NaiveTime`, wrap as `Timetz`, and bind as TIMETZ (PgTimeTz with a stable offset, preferably `+00:00` or the process local fixed offset). Decoding always discards offset for domain use.

**Rationale**: Matches Nest “wall-clock hours/minutes” contract. Avoids accidental UTC shifts when combining `scheduled_date` + time in `resolve_scheduled_due_at`.

**Alternatives considered**: Persist as `TIMESTAMP` — rejected; would require schema change and diverge from Nest.

## R4 — Auto-publish validation strategy

**Decision**: (1) Unit-test Timetz round-trip / parse of strings like `14:30:00+02`. (2) Integration or manual: load `content_items` with non-null timetz via SeaORM. (3) After deploy, confirm logs have no TIMETZ mismatch for ≥ one cron interval with due rows.

**Rationale**: Constitution prefers contract/smoke over mocks for boundary bugs; this is an SQLx boundary. Full publish to X/Meta is out of scope for proving the decode fix.

**Alternatives considered**: Only production observation — insufficient for CI.

## R5 — Deployment / ops

**Decision**: Rebuild and redeploy Dokploy Rust `api` image only. No env var changes. Ensure Nest auto-publish workers remain off in that environment.

**Rationale**: Constitution V — single cron owner. Bug is decode-only.

## Resolved clarifications

All Technical Context items are resolved; no remaining `NEEDS CLARIFICATION`.
