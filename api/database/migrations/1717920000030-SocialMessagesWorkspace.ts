import { MigrationInterface, QueryRunner } from 'typeorm';

export class SocialMessagesWorkspace1717920000030 implements MigrationInterface {
  name = 'SocialMessagesWorkspace1717920000030';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE social_messages
        ADD COLUMN IF NOT EXISTS workspace_id UUID NULL
    `);
    await queryRunner.query(`
      ALTER TABLE social_messages
        DROP CONSTRAINT IF EXISTS social_messages_workspace_id_fkey
    `);
    await queryRunner.query(`
      ALTER TABLE social_messages
        ADD CONSTRAINT social_messages_workspace_id_fkey
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`
      UPDATE social_messages t
      SET workspace_id = sub.id
      FROM (
        SELECT DISTINCT ON (w.tenant_id) w.id, w.tenant_id
        FROM workspaces w
        ORDER BY w.tenant_id, w.created_at ASC
      ) sub
      WHERE t.tenant_id = sub.tenant_id
        AND t.workspace_id IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS social_messages_workspace_idx
        ON social_messages (workspace_id)
        WHERE workspace_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS social_messages_workspace_idx`);
    await queryRunner.query(`
      ALTER TABLE social_messages
        DROP CONSTRAINT IF EXISTS social_messages_workspace_id_fkey
    `);
    await queryRunner.query(`
      ALTER TABLE social_messages
        DROP COLUMN IF EXISTS workspace_id
    `);
  }
}
