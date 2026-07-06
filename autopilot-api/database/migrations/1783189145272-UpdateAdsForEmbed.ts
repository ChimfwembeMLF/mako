import { MigrationInterface, QueryRunner } from 'typeorm';

/** Idempotent embed / native-tracking columns (safe if CreateAdsTables already ran). */
export class UpdateAdsForEmbed1783189145272 implements MigrationInterface {
  name = 'UpdateAdsForEmbed1783189145272';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ad_campaigns
        ADD COLUMN IF NOT EXISTS target_url varchar,
        ADD COLUMN IF NOT EXISTS native_impressions integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS native_clicks integer NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ad_campaigns
        DROP COLUMN IF EXISTS native_clicks,
        DROP COLUMN IF EXISTS native_impressions,
        DROP COLUMN IF EXISTS target_url
    `);
  }
}
