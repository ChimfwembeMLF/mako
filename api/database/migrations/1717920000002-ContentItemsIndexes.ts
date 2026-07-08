import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContentItemsIndexes1717920000002 implements MigrationInterface {
  name = 'ContentItemsIndexes1717920000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ca13f8e21912b0ac8c1e5ee916"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_8b0a8f8c8e8e8e8e8e8e8e8e8"`);

    await queryRunner.query(`
      DO $$
      DECLARE idx RECORD;
      BEGIN
        FOR idx IN
          SELECT indexname
          FROM pg_indexes
          WHERE tablename = 'content_items'
            AND indexdef LIKE '%UNIQUE%'
            AND (
              indexdef LIKE '%workspace_id%status%'
              OR indexdef LIKE '%tenant_id%status%scheduled_date%'
            )
        LOOP
          EXECUTE format('DROP INDEX IF EXISTS %I', idx.indexname);
        END LOOP;
      END $$
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_content_items_workspace_status
        ON content_items (workspace_id, status)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_content_items_tenant_status_scheduled
        ON content_items (tenant_id, status, scheduled_date)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_content_items_tenant_status_scheduled`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_content_items_workspace_status`);
  }
}
