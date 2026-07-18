import { MigrationInterface, QueryRunner } from 'typeorm';

/** Allow X / Twitter as a sign-in provider on users. */
export class UserTwitterAuthProvider1784376000000 implements MigrationInterface {
  name = 'UserTwitterAuthProvider1784376000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "users_provider_enum" ADD VALUE 'twitter';
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS is_registered_with_twitter boolean
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        DROP COLUMN IF EXISTS is_registered_with_twitter
    `);
  }
}
