import { MigrationInterface, QueryRunner } from 'typeorm';

export class AutoReplyRules1717920000012 implements MigrationInterface {
  name = 'AutoReplyRules1717920000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS auto_reply_rules (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        platform text NOT NULL,
        name text NOT NULL,
        trigger_keywords text[],
        trigger_sentiment text,
        response_template text,
        ai_generate boolean NOT NULL DEFAULT false,
        is_active boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_auto_reply_rules_tenant_platform"
        ON auto_reply_rules (tenant_id, platform)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_auto_reply_rules_tenant_platform_name"
        ON auto_reply_rules (tenant_id, platform, name)
        WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_auto_reply_rules_tenant_platform_name"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_auto_reply_rules_tenant_platform"`);
    await queryRunner.query(`DROP TABLE IF EXISTS auto_reply_rules`);
  }
}
