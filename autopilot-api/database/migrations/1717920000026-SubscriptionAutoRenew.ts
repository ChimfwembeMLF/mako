import { MigrationInterface, QueryRunner } from 'typeorm';

export class SubscriptionAutoRenew1717920000026 implements MigrationInterface {
  name = 'SubscriptionAutoRenew1717920000026';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenant_subscriptions
        ADD COLUMN IF NOT EXISTS auto_renew_enabled BOOLEAN NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE tenant_subscriptions
        ADD COLUMN IF NOT EXISTS renewal_phone TEXT
    `);
    await queryRunner.query(`
      ALTER TABLE tenant_subscriptions
        ADD COLUMN IF NOT EXISTS renewal_correspondent TEXT
    `);
    await queryRunner.query(`
      ALTER TABLE tenant_subscriptions
        ADD COLUMN IF NOT EXISTS renewal_attempts INT NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE tenant_subscriptions
        ADD COLUMN IF NOT EXISTS last_renewal_attempt_at TIMESTAMPTZ
    `);
    await queryRunner.query(`
      ALTER TABLE deposits
        ADD COLUMN IF NOT EXISTS is_renewal BOOLEAN NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE deposits DROP COLUMN IF EXISTS is_renewal`);
    await queryRunner.query(`ALTER TABLE tenant_subscriptions DROP COLUMN IF EXISTS last_renewal_attempt_at`);
    await queryRunner.query(`ALTER TABLE tenant_subscriptions DROP COLUMN IF EXISTS renewal_attempts`);
    await queryRunner.query(`ALTER TABLE tenant_subscriptions DROP COLUMN IF EXISTS renewal_correspondent`);
    await queryRunner.query(`ALTER TABLE tenant_subscriptions DROP COLUMN IF EXISTS renewal_phone`);
    await queryRunner.query(`ALTER TABLE tenant_subscriptions DROP COLUMN IF EXISTS auto_renew_enabled`);
  }
}
