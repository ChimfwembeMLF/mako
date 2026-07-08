import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateAdsCampaignVariables1783191819576 implements MigrationInterface {
  name = 'UpdateAdsCampaignVariables1783191819576';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ad_campaigns
        ADD COLUMN IF NOT EXISTS location varchar,
        ADD COLUMN IF NOT EXISTS age_range varchar
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ad_campaigns
        DROP COLUMN IF EXISTS age_range,
        DROP COLUMN IF EXISTS location
    `);
  }
}
