import { MigrationInterface, QueryRunner } from 'typeorm';

/** Rename misnamed camelCase column from UserTwitterAuthProvider migration. */
export class FixTwitterAuthColumnName1784376100000 implements MigrationInterface {
  name = 'FixTwitterAuthColumnName1784376100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS is_registered_with_twitter boolean
    `);

    await queryRunner.query(`
      ALTER TABLE users
        DROP COLUMN IF EXISTS "isRegisteredWithTwitter"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS "isRegisteredWithTwitter" boolean
    `);

    await queryRunner.query(`
      ALTER TABLE users
        DROP COLUMN IF EXISTS is_registered_with_twitter
    `);
  }
}
