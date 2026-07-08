import { MigrationInterface, QueryRunner } from 'typeorm';

/** Extend platform enum with additional providers. */
export class UpdateAdsPlatformEnum1783190874268 implements MigrationInterface {
  name = 'UpdateAdsPlatformEnum1783190874268';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const values = [
      'TIKTOK',
      'LINKEDIN',
      'PINTEREST',
      'TABOOLA',
      'X',
      'EMBED',
    ];
    for (const value of values) {
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TYPE "ad_campaigns_platform_enum" ADD VALUE '${value}';
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `);
    }
  }

  public async down(): Promise<void> {
    // PostgreSQL does not support removing enum values safely.
  }
}
