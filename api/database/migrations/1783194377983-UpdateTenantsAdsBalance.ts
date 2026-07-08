import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateTenantsAdsBalance1783194377983 implements MigrationInterface {
  name = 'UpdateTenantsAdsBalance1783194377983';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenants
        ADD COLUMN IF NOT EXISTS ads_balance numeric(10, 2) NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenants DROP COLUMN IF EXISTS ads_balance
    `);
  }
}
