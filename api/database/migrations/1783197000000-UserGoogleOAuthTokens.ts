import { MigrationInterface, QueryRunner } from 'typeorm';

/** Encrypted Google OAuth tokens on users (Gmail API send). */
export class UserGoogleOAuthTokens1783197000000 implements MigrationInterface {
  name = 'UserGoogleOAuthTokens1783197000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS google_access_token_enc TEXT,
        ADD COLUMN IF NOT EXISTS google_refresh_token_enc TEXT,
        ADD COLUMN IF NOT EXISTS google_token_expires_at TIMESTAMPTZ
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        DROP COLUMN IF EXISTS google_access_token_enc,
        DROP COLUMN IF EXISTS google_refresh_token_enc,
        DROP COLUMN IF EXISTS google_token_expires_at
    `);
  }
}
