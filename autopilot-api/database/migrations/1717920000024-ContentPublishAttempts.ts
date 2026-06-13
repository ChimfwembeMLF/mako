import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContentPublishAttempts1717920000024 implements MigrationInterface {
  name = 'ContentPublishAttempts1717920000024';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE content_items
        ADD COLUMN IF NOT EXISTS publish_attempts int NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE content_items
        DROP COLUMN IF EXISTS publish_attempts
    `);
  }
}
