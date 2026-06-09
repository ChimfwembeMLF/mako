-- Fixes approval_workflows PK migration (action_key PK -> uuid id + tenant_id).
-- Safe when approval_workflows / approval_requests have no rows (or you accept losing them).
-- Run: npm run db:fix-schema

BEGIN;

-- Remove FK that blocks PK change on approval_workflows
ALTER TABLE approval_requests
  DROP CONSTRAINT IF EXISTS "FK_09e748be3e6e1232f6b3023e5bc";

-- Empty table: drop and let TypeORM recreate with synchronize=true
DROP TABLE IF EXISTS approval_workflows;

COMMIT;
