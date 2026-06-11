import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatbotConfigTenantUnique1717920000020 implements MigrationInterface {
  name = 'ChatbotConfigTenantUnique1717920000020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM chatbot_configs a
      USING chatbot_configs b
      WHERE a.tenant_id = b.tenant_id
        AND a.created_at > b.created_at
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_chatbot_configs_tenant_unique
        ON chatbot_configs(tenant_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_chatbot_configs_tenant_unique`);
  }
}
