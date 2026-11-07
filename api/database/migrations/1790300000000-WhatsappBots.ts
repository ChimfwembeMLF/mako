import { MigrationInterface, QueryRunner } from 'typeorm';

/** Visual WhatsApp bots built in the drag-and-drop builder. */
export class WhatsappBots1790300000000 implements MigrationInterface {
  name = 'WhatsappBots1790300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "whatsapp_bots" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "workspace_id" uuid,
        "name" text NOT NULL,
        "description" text,
        "status" text NOT NULL DEFAULT 'draft',
        "is_default" boolean NOT NULL DEFAULT false,
        "triggers" jsonb NOT NULL DEFAULT '[]',
        "graph" jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
        "published_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_whatsapp_bots" PRIMARY KEY ("id"),
        CONSTRAINT "FK_whatsapp_bots_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_whatsapp_bots_tenant_workspace" ON "whatsapp_bots" ("tenant_id", "workspace_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "whatsapp_bots"`);
  }
}
