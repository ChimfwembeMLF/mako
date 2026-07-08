import { MigrationInterface, QueryRunner } from 'typeorm';

export class PublicationEngagement1717920000013 implements MigrationInterface {
  name = 'PublicationEngagement1717920000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE content_publications
        ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS comment_count integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS share_count integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS engagement_score integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS engagement_synced_at timestamptz
    `);
    await queryRunner.query(`
      ALTER TABLE comment_replies
        ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS is_from_brand boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_content_publications_tenant_engagement"
        ON content_publications (tenant_id, engagement_score DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_content_publications_tenant_engagement"`);
    await queryRunner.query(`
      ALTER TABLE comment_replies
        DROP COLUMN IF EXISTS is_from_brand,
        DROP COLUMN IF EXISTS like_count
    `);
    await queryRunner.query(`
      ALTER TABLE content_publications
        DROP COLUMN IF EXISTS engagement_synced_at,
        DROP COLUMN IF EXISTS engagement_score,
        DROP COLUMN IF EXISTS view_count,
        DROP COLUMN IF EXISTS share_count,
        DROP COLUMN IF EXISTS comment_count,
        DROP COLUMN IF EXISTS like_count
    `);
  }
}
