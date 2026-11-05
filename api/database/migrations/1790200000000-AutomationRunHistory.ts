import { MigrationInterface, QueryRunner } from 'typeorm';

/** Records when each workspace's automation last ran and its recent results. */
export class AutomationRunHistory1790200000000 implements MigrationInterface {
  name = 'AutomationRunHistory1790200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "workspace_automation_configs" ADD COLUMN IF NOT EXISTS "last_run_at" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "workspace_automation_configs" ADD COLUMN IF NOT EXISTS "recent_runs" jsonb NOT NULL DEFAULT '[]'`);
    await queryRunner.query(`ALTER TABLE "workspace_automation_configs" ALTER COLUMN "timezone" SET DEFAULT 'Africa/Lusaka'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "workspace_automation_configs" ALTER COLUMN "timezone" SET DEFAULT 'America/New_York'`);
    await queryRunner.query(`ALTER TABLE "workspace_automation_configs" DROP COLUMN IF EXISTS "recent_runs"`);
    await queryRunner.query(`ALTER TABLE "workspace_automation_configs" DROP COLUMN IF EXISTS "last_run_at"`);
  }
}
