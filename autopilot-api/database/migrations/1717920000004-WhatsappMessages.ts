import { MigrationInterface, QueryRunner } from 'typeorm';

export class WhatsappMessages1717920000004 implements MigrationInterface {
  name = 'WhatsappMessages1717920000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        contact_id uuid REFERENCES whatsapp_contacts(id) ON DELETE SET NULL,
        wa_message_id text,
        phone text NOT NULL,
        direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
        body text NOT NULL,
        status text NOT NULL DEFAULT 'delivered',
        error_message text,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_whatsapp_messages_wa_message_id"
        ON whatsapp_messages (wa_message_id) WHERE wa_message_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_whatsapp_messages_tenant_created"
        ON whatsapp_messages (tenant_id, created_at DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS whatsapp_messages`);
  }
}
