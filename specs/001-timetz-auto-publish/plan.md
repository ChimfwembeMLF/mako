# Implementation Plan: Fix TIMETZ scheduled_time decoding for auto-publish

**Branch**: `001-timetz-auto-publish` | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-timetz-auto-publish/spec.md`

## Summary

Production Rust auto-publish fails because SeaORM/SQLx maps `Option<NaiveTime>` (including via `#[derive(DeriveValueType)]` wrappers) to PostgreSQL `TIME`, while Nest stores `content_items.scheduled_time` as `TIMETZ`. Fix the Rust `Timetz` value type to decode/encode via SQLx `PgTimeTz` (or an equivalent custom `TryGetable`/`ValueType`/`From`/`Into` path), keep wall-clock scheduling semantics aligned with Nest, and validate via unit tests plus an auto-publish load path check. No schema migration required for the primary fix.

## Technical Context

**Language/Version**: Rust (edition 2021), workspace `api-rust/`

**Primary Dependencies**: Axum, SeaORM 1.1.x (`sqlx-postgres`, `with-chrono`), chrono, Tokio

**Storage**: Shared PostgreSQL; column `content_items.scheduled_time` type `timetz` (Nest TypeORM). No migration planned for P1.

**Testing**: `cargo test` in `api-rust/` (unit tests for Timetz decode/parse); optional smoke against staging DB; production log check for absence of TIMETZ decode errors

**Target Platform**: Linux Docker (Dokploy `api` service)

**Project Type**: Web service (monorepo API)

**Performance Goals**: Auto-publish cron continues to load candidate rows every ~5 minutes without decode failures; no new latency budget beyond existing query

**Constraints**: Must not run Nest + Rust auto-publish workers in the same environment; must not commit secrets; keep API `scheduledTime` string shape for `client/`

**Scale/Scope**: Single column mapping + schedule helpers + auto-publish regression coverage; touches `api-rust/src/modules/content_items/` primarily

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Nest–Rust parity**: Live fix in `api-rust/`; Nest already correct with `timetz` + string parse. Document in migration notes only if temporary workarounds remain (none expected).
- [x] **II. Tenancy**: Auto-publish system job unchanged; content CRUD paths retain existing tenant checks. No new cross-tenant data path.
- [x] **III. Secrets**: No secrets in artifacts; no Dokploy env changes required for this bug.
- [x] **IV. Contracts**: Document decode/API schedule string contract under `contracts/`; verify with unit tests + auto-publish log/smoke path.
- [x] **V. Background work**: Single owner remains Rust cron/queue; fix does not enable dual workers.
- [x] **Stack**: No Nest migration for primary path; Docker/Dokploy impact = rebuild/redeploy `api` image only.

Post-design re-check: **PASS** — design keeps Nest schema, Rust-only decode fix, wall-clock parity, single cron owner.

## Project Structure

### Documentation (this feature)

```text
specs/001-timetz-auto-publish/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/           # Phase 1
└── tasks.md             # Phase 2 (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
api/                 # NestJS (migrations + Nest reference) — no schema change expected
api-rust/            # Axum production API — Timetz mapping + auto-publish load path
client/              # unchanged (already expects scheduledTime string)
docker-compose.yml   # rebuild api service after fix
docs/                # optional one-line note in RUST_MIGRATION if useful
specs/               # this feature
```

**Structure Decision**: Implement solely in `api-rust` content_items TIMETZ mapping; do not invent parallel types outside that module.

## Complexity Tracking

> No constitution violations requiring justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
