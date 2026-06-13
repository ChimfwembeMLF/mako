import { MigrationInterface, QueryRunner } from 'typeorm';

export class DataProtectionConsent1717920000025 implements MigrationInterface {
  name = 'DataProtectionConsent1717920000025';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS data_protection_consents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        visitor_id TEXT NOT NULL,
        user_id UUID,
        consent_version TEXT NOT NULL DEFAULT '1',
        accepted BOOLEAN NOT NULL DEFAULT true,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_data_protection_consents_visitor
        ON data_protection_consents (visitor_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_data_protection_consents_user
        ON data_protection_consents (user_id)
    `);

    await queryRunner.query(`
      ALTER TABLE data_deletion_requests
        ADD COLUMN IF NOT EXISTS user_id UUID
    `);
    await queryRunner.query(`
      ALTER TABLE data_deletion_requests
        ADD COLUMN IF NOT EXISTS ip_address TEXT
    `);
    await queryRunner.query(`
      ALTER TABLE data_deletion_requests
        ADD COLUMN IF NOT EXISTS user_agent TEXT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE data_deletion_requests DROP COLUMN IF EXISTS user_agent`);
    await queryRunner.query(`ALTER TABLE data_deletion_requests DROP COLUMN IF EXISTS ip_address`);
    await queryRunner.query(`ALTER TABLE data_deletion_requests DROP COLUMN IF EXISTS user_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS data_protection_consents`);
  }
}
