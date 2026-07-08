import { MigrationInterface, QueryRunner } from 'typeorm';

export class WhatsappLeads1717920000005 implements MigrationInterface {
  name = 'WhatsappLeads1717920000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE whatsapp_contacts
        ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES leads(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE whatsapp_messages
        ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES leads(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_whatsapp_contacts_lead_id" ON whatsapp_contacts (lead_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_whatsapp_messages_lead_id" ON whatsapp_messages (lead_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_whatsapp_messages_lead_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_whatsapp_contacts_lead_id"`);
    await queryRunner.query(`ALTER TABLE whatsapp_messages DROP COLUMN IF EXISTS lead_id`);
    await queryRunner.query(`ALTER TABLE whatsapp_contacts DROP COLUMN IF EXISTS lead_id`);
  }
}
