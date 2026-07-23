# Mako API — Rust port

Axum + SeaORM rewrite of the NestJS API in `api/`. Shares the same PostgreSQL database and `.env` conventions.

## Status

See **[`api/docs/RUST_MIGRATION.md`](../api/docs/RUST_MIGRATION.md)** for the full endpoint/entity checklist.

| Area | NestJS (`api/`) | Rust (`api-rust/`) |
|------|----------------:|-------------------:|
| HTTP endpoints | 302 | 37 |
| SeaORM entities | — | 11 / 51 |
| Modules started | 43 | 7 |

## Requirements

- Rust 1.75+
- PostgreSQL (same DB as the TypeScript API)
- `api/.env` (or copy into `api-rust/.env`)

## Run locally

```bash
cd api-rust
# Uses DB_* and JWT_SECRET from ../api/.env when api-rust/.env is absent
cargo run
```

Default port: `PORT` from env, or **4000** if unset.

## Environment

The Rust port reads the same variables as the NestJS API:

| Variable | Purpose |
|----------|---------|
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` | PostgreSQL connection |
| `JWT_SECRET` | Access + refresh token signing |
| `PORT` | HTTP listen port |
| `NODE_ENV` | Loaded (parity); not yet used for behavior |

`DATABASE_URL` is built automatically from `DB_*` — you do not need to set it separately.

## Implemented routes (Phase 1)

| Method | Path |
|--------|------|
| GET | `/api/v1/health` |
| POST | `/api/v1/auth/login` |
| POST | `/api/v1/auth/register` |
| POST | `/api/v1/auth/refresh` |
| GET | `/api/v1/auth/me` |
| POST, GET | `/api/v1/tenants` |
| GET | `/api/v1/tenants/mine` |
| GET, PATCH, DELETE | `/api/v1/tenants/:id` |
| POST, GET | `/api/v1/workspaces` |
| GET, PATCH, DELETE | `/api/v1/workspaces/:id` |
| GET | `/api/v1/rbac/effective-permissions/:tenantId/:userId` |
| GET | `/api/v1/rbac/roles/check/:tenantId/:userId` |
| GET | `/api/v1/rbac/permissions/check/:tenantId/:userId` |

## CI / deploy

```bash
# Local CI (same as GitHub Actions)
./scripts/ci-check.sh

# Dokploy: docker-compose.yml builds this crate as the `api` service (port 4000)
# See docs/DOKPLOY_RUST.md

# Production PM2 (port 4006 — dual-run with NestJS on 4005)
./scripts/deploy-production.sh
```

See **`docs/DUAL_RUN.md`**, **`../docs/DOKPLOY_RUST.md`**, and **`../api/docs/RUST_CUTOVER.md`**.

## Smoke parity tests

With both APIs running against the same database:

```bash
cd api-rust
./scripts/smoke-parity.sh
# Optional: compare authenticated GET routes too
SMOKE_TOKEN="<access_token>" ./scripts/smoke-parity.sh
```

Defaults: Rust `http://127.0.0.1:4000`, NestJS `http://127.0.0.1:3000`. Override with `RUST_BASE` / `NEST_BASE`.

## Architecture

```
api-rust/src/
├── main.rs           # Axum router, CORS, tracing
├── config.rs         # Env → AppConfig (DB URL, JWT, port)
├── app_state.rs      # Shared DB + config
├── common/
│   ├── error.rs      # NestJS-shaped JSON errors
│   └── guards/auth.rs
└── modules/
    ├── auth/
    ├── health/
    ├── tenants/      # + bootstrap (default tenant on first login)
    ├── workspaces/
    ├── users/        # SeaORM entity only
    ├── tenant_members/
    ├── roles/
    ├── rbac/           # effective-permissions (F1 — every page)
    ├── profiles/       # entity only
    ├── permissions/    # entity only
    ├── role_permissions/
    └── user_permissions/
```

## Migration strategy

Prioritized by **functional importance** (F0–F7 tiers in `api/docs/RUST_MIGRATION.md`):

1. **F0 Platform gate** — auth, tenancy (mostly done)
2. **F1 App shell** — RBAC ✅, team, profiles, theme, OAuth
3. **F2 Core product** — Brand Brain → Publisher → Content Engine
4. **F3 Monetization** — billing, subscriptions
5. **F4–F7** — engagement, advanced, compliance, cutover

Track every endpoint in `api/docs/RUST_MIGRATION.md`.
