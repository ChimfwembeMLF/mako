import { MigrationInterface, QueryRunner } from 'typeorm';

export class WhatsappFlowAi1717920000010 implements MigrationInterface {
  name = 'WhatsappFlowAi1717920000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE whatsapp_flow_configs
        ADD COLUMN IF NOT EXISTS ai_fallback_enabled boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE whatsapp_flow_configs DROP COLUMN IF EXISTS ai_fallback_enabled
    `);
  }
}
