import { MigrationInterface, QueryRunner } from 'typeorm';

export class WhatsappTemplates1783196000000 implements MigrationInterface {
  name = 'WhatsappTemplates1783196000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_templates (
        id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        workspace_id    uuid,
        name            text        NOT NULL,
        language        text        NOT NULL DEFAULT 'en',
        category        text        NOT NULL DEFAULT 'UTILITY',
        status          text        NOT NULL DEFAULT 'DRAFT',
        components      jsonb       NOT NULL DEFAULT '[]',
        variables       jsonb       NOT NULL DEFAULT '[]',
        meta_template_id text,
        rejection_reason text,
        synced_at       timestamptz,
        created_at      timestamptz NOT NULL DEFAULT now(),
        updated_at      timestamptz NOT NULL DEFAULT now()
      )
    `);

    /* Fast tenant-scoped lookups */
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_whatsapp_templates_tenant"
        ON whatsapp_templates (tenant_id)
    `);

    /* Workspace-scoped lookups */
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_whatsapp_templates_tenant_workspace"
        ON whatsapp_templates (tenant_id, workspace_id)
        WHERE workspace_id IS NOT NULL
    `);

    /* Prevent duplicate name+language per tenant */
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_whatsapp_templates_tenant_name_lang"
        ON whatsapp_templates (tenant_id, name, language)
    `);

    /* Quick filter by status */
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_whatsapp_templates_status"
        ON whatsapp_templates (tenant_id, status)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_whatsapp_templates_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_whatsapp_templates_tenant_name_lang"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_whatsapp_templates_tenant_workspace"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_whatsapp_templates_tenant"`);
    await queryRunner.query(`DROP TABLE IF EXISTS whatsapp_templates`);
  }
}
