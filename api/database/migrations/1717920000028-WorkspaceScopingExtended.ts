import { MigrationInterface, QueryRunner } from 'typeorm';

const TABLES = [
  'social_accounts',
  'media_assets',
  'content_templates',
  'knowledge_documents',
  'chatbot_configs',
  'chat_sessions',
  'leads',
  'auto_reply_rules',
  'whatsapp_flow_configs',
  'whatsapp_messages',
  'whatsapp_contacts',
  'content_publications',
] as const;

export class WorkspaceScopingExtended1717920000028 implements MigrationInterface {
  name = 'WorkspaceScopingExtended1717920000028';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await queryRunner.query(`
        ALTER TABLE ${table}
          ADD COLUMN IF NOT EXISTS workspace_id UUID NULL
      `);
      await queryRunner.query(`
        ALTER TABLE ${table}
          DROP CONSTRAINT IF EXISTS ${table}_workspace_id_fkey
      `);
      await queryRunner.query(`
        ALTER TABLE ${table}
          ADD CONSTRAINT ${table}_workspace_id_fkey
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      `);
      await queryRunner.query(`
        UPDATE ${table} t
        SET workspace_id = sub.id
        FROM (
          SELECT DISTINCT ON (w.tenant_id) w.id, w.tenant_id
          FROM workspaces w
          ORDER BY w.tenant_id, w.created_at ASC
        ) sub
        WHERE t.tenant_id = sub.tenant_id
          AND t.workspace_id IS NULL
      `);
    }

    await queryRunner.query(`DROP INDEX IF EXISTS idx_chatbot_configs_tenant_unique`);
    await queryRunner.query(`
      DELETE FROM chatbot_configs dup
      USING chatbot_configs keep
      WHERE dup.workspace_id IS NOT NULL
        AND dup.workspace_id = keep.workspace_id
        AND dup.id > keep.id
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS chatbot_configs_tenant_legacy
        ON chatbot_configs (tenant_id)
        WHERE workspace_id IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS chatbot_configs_workspace_unique
        ON chatbot_configs (workspace_id)
        WHERE workspace_id IS NOT NULL
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_content_templates_tenant_name"`);
    await queryRunner.query(`
      DELETE FROM content_templates dup
      USING content_templates keep
      WHERE dup.workspace_id IS NOT NULL
        AND dup.workspace_id = keep.workspace_id
        AND dup.name = keep.name
        AND dup.deleted_at IS NULL
        AND keep.deleted_at IS NULL
        AND dup.id > keep.id
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS content_templates_tenant_name_legacy
        ON content_templates (tenant_id, name)
        WHERE workspace_id IS NULL AND deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS content_templates_workspace_name
        ON content_templates (workspace_id, name)
        WHERE workspace_id IS NOT NULL AND deleted_at IS NULL
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS whatsapp_flow_configs_tenant_id_key
    `);
    await queryRunner.query(`
      DELETE FROM whatsapp_flow_configs dup
      USING whatsapp_flow_configs keep
      WHERE dup.workspace_id IS NOT NULL
        AND dup.workspace_id = keep.workspace_id
        AND dup.id > keep.id
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_flow_configs_tenant_legacy
        ON whatsapp_flow_configs (tenant_id)
        WHERE workspace_id IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_flow_configs_workspace_unique
        ON whatsapp_flow_configs (workspace_id)
        WHERE workspace_id IS NOT NULL
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_whatsapp_contacts_tenant_phone"`);
    await queryRunner.query(`
      DELETE FROM whatsapp_contacts dup
      USING whatsapp_contacts keep
      WHERE dup.workspace_id IS NOT NULL
        AND dup.workspace_id = keep.workspace_id
        AND dup.phone = keep.phone
        AND dup.id > keep.id
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_contacts_tenant_phone_legacy
        ON whatsapp_contacts (tenant_id, phone)
        WHERE workspace_id IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_contacts_workspace_phone
        ON whatsapp_contacts (workspace_id, phone)
        WHERE workspace_id IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS social_accounts_workspace_idx
        ON social_accounts (workspace_id)
        WHERE workspace_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS media_assets_workspace_idx
        ON media_assets (workspace_id)
        WHERE workspace_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS knowledge_documents_workspace_idx
        ON knowledge_documents (workspace_id, status)
        WHERE workspace_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS leads_workspace_idx
        ON leads (workspace_id)
        WHERE workspace_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS content_publications_workspace_idx
        ON content_publications (workspace_id, status)
        WHERE workspace_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS content_publications_workspace_idx`);
    await queryRunner.query(`DROP INDEX IF EXISTS leads_workspace_idx`);
    await queryRunner.query(`DROP INDEX IF EXISTS knowledge_documents_workspace_idx`);
    await queryRunner.query(`DROP INDEX IF EXISTS media_assets_workspace_idx`);
    await queryRunner.query(`DROP INDEX IF EXISTS social_accounts_workspace_idx`);

    await queryRunner.query(`DROP INDEX IF EXISTS whatsapp_contacts_workspace_phone`);
    await queryRunner.query(`DROP INDEX IF EXISTS whatsapp_contacts_tenant_phone_legacy`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_whatsapp_contacts_tenant_phone"
        ON whatsapp_contacts (tenant_id, phone)
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS whatsapp_flow_configs_workspace_unique`);
    await queryRunner.query(`DROP INDEX IF EXISTS whatsapp_flow_configs_tenant_legacy`);

    await queryRunner.query(`DROP INDEX IF EXISTS content_templates_workspace_name`);
    await queryRunner.query(`DROP INDEX IF EXISTS content_templates_tenant_name_legacy`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_content_templates_tenant_name"
        ON content_templates (tenant_id, name)
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS chatbot_configs_workspace_unique`);
    await queryRunner.query(`DROP INDEX IF EXISTS chatbot_configs_tenant_legacy`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_chatbot_configs_tenant_unique
        ON chatbot_configs (tenant_id)
    `);

    for (const table of [...TABLES].reverse()) {
      await queryRunner.query(`
        ALTER TABLE ${table}
          DROP CONSTRAINT IF EXISTS ${table}_workspace_id_fkey
      `);
      await queryRunner.query(`
        ALTER TABLE ${table}
          DROP COLUMN IF EXISTS workspace_id
      `);
    }
  }
}
