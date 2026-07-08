import { MigrationInterface, QueryRunner } from 'typeorm';

export class WhatsappFlowMenuItems1717920000009 implements MigrationInterface {
  name = 'WhatsappFlowMenuItems1717920000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE whatsapp_flow_configs
        ADD COLUMN IF NOT EXISTS menu_items jsonb NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS welcome_message text
    `);

    await queryRunner.query(`
      UPDATE whatsapp_flow_configs
      SET flow_type = 'configurable_menu'
      WHERE flow_type = 'microfinance_demo'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE whatsapp_flow_configs
        DROP COLUMN IF EXISTS menu_items,
        DROP COLUMN IF EXISTS welcome_message
    `);
  }
}
