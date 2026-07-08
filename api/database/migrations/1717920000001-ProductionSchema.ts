import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductionSchema1717920000001 implements MigrationInterface {
  name = 'ProductionSchema1717920000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS content_publications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        content_id UUID NOT NULL,
        user_id UUID NOT NULL,
        platform TEXT NOT NULL,
        external_post_id TEXT,
        published_content TEXT NOT NULL,
        published_title TEXT,
        published_media JSONB,
        social_account_id UUID,
        status TEXT NOT NULL DEFAULT 'published',
        error_message TEXT,
        published_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_content_publications_content_platform
        ON content_publications (content_id, platform)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_content_publications_tenant_status
        ON content_publications (tenant_id, status)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS data_deletion_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        confirmation_code TEXT NOT NULL UNIQUE,
        platform TEXT NOT NULL DEFAULT 'meta',
        external_user_id TEXT,
        email TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_data_deletion_confirmation
        ON data_deletion_requests (confirmation_code)
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS comment_replies_content_id_key`);
    await queryRunner.query(`DROP INDEX IF EXISTS comment_replies_rule_id_key`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_comment_replies_tenant_external_comment
        ON comment_replies (tenant_id, external_comment_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_comment_replies_tenant_external_comment`);
    await queryRunner.query(`DROP TABLE IF EXISTS data_deletion_requests`);
    await queryRunner.query(`DROP TABLE IF EXISTS content_publications`);
  }
}
