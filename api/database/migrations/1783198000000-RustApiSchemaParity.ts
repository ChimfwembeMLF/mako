import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Columns required by api-rust that were missing from production databases.
 * Safe to re-run: every ADD uses IF NOT EXISTS.
 */
export class RustApiSchemaParity1783198000000 implements MigrationInterface {
  name = 'RustApiSchemaParity1783198000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Gmail / Google OAuth token storage (encrypted at rest)
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS google_access_token_enc TEXT,
        ADD COLUMN IF NOT EXISTS google_refresh_token_enc TEXT,
        ADD COLUMN IF NOT EXISTS google_token_expires_at TIMESTAMPTZ
    `);

    // Brand profile type (business | product | professional_resume)
    await queryRunner.query(`
      ALTER TABLE brand_profiles
        ADD COLUMN IF NOT EXISTS brand_type TEXT NOT NULL DEFAULT 'business'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE brand_profiles
        DROP COLUMN IF EXISTS brand_type
    `);

    await queryRunner.query(`
      ALTER TABLE users
        DROP COLUMN IF EXISTS google_access_token_enc,
        DROP COLUMN IF EXISTS google_refresh_token_enc,
        DROP COLUMN IF EXISTS google_token_expires_at
    `);
  }
}
