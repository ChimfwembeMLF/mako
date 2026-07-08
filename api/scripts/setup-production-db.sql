-- Run as PostgreSQL superuser (postgres) on the production server.
-- Fixes: "permission denied for schema public" (common on PostgreSQL 15+)
--
-- Usage:
--   sudo -u postgres psql -f scripts/setup-production-db.sql
--
-- Or paste into psql interactively.

-- 1. Create role + database (skip if already exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mako') THEN
    CREATE ROLE mako WITH LOGIN PASSWORD 'CHANGE_ME';
  END IF;
END
$$;

SELECT 'CREATE DATABASE autopilot_prod OWNER mako'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'autopilot_prod')\gexec

-- 2. Connect to app database
\c autopilot_prod

-- 3. Owner + schema permissions (PostgreSQL 15+ public schema lockdown)
ALTER DATABASE autopilot_prod OWNER TO mako;
ALTER SCHEMA public OWNER TO mako;
GRANT ALL ON SCHEMA public TO mako;
GRANT CREATE ON SCHEMA public TO mako;
GRANT USAGE ON SCHEMA public TO mako;

-- 4. Existing objects (if any)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mako;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mako;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO mako;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO mako;

\echo 'Done. Set DB_DATABASE=autopilot_prod and DB_SYNCHRONIZE=false in .env, then run: npm run db:sync && npm run migrations:run'
