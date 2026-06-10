import { MigrationInterface, QueryRunner } from 'typeorm';

export class SocialAccountsNullableTokens1717920000007 implements MigrationInterface {
  name = 'SocialAccountsNullableTokens1717920000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE social_accounts
        ALTER COLUMN access_token DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE social_accounts SET access_token = '' WHERE access_token IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE social_accounts
        ALTER COLUMN access_token SET NOT NULL
    `);
  }
}
