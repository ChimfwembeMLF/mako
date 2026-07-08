import { MigrationInterface, QueryRunner } from 'typeorm';

export class WhatsappFlowSessions1717920000008 implements MigrationInterface {
  name = 'WhatsappFlowSessions1717920000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_flow_configs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        enabled boolean NOT NULL DEFAULT false,
        service_name text NOT NULL DEFAULT 'MyService',
        flow_type text NOT NULL DEFAULT 'microfinance_demo',
        welcome_triggers text[] NOT NULL DEFAULT ARRAY['hi','hello','menu','start','0'],
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (tenant_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_flow_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        phone text NOT NULL,
        current_state text NOT NULL DEFAULT 'MAIN_MENU',
        context jsonb NOT NULL DEFAULT '{}',
        expires_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (tenant_id, phone)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_whatsapp_flow_sessions_tenant_updated"
        ON whatsapp_flow_sessions (tenant_id, updated_at DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS whatsapp_flow_sessions`);
    await queryRunner.query(`DROP TABLE IF EXISTS whatsapp_flow_configs`);
  }
}
