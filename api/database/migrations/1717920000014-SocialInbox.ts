import { MigrationInterface, QueryRunner } from 'typeorm';

export class SocialInbox1717920000014 implements MigrationInterface {
  name = 'SocialInbox1717920000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS social_messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        platform text NOT NULL,
        thread_id text NOT NULL,
        external_message_id text,
        participant_id text NOT NULL,
        participant_name text,
        participant_avatar_url text,
        direction text NOT NULL DEFAULT 'inbound',
        body text NOT NULL DEFAULT '',
        attachments jsonb NOT NULL DEFAULT '[]',
        reactions jsonb NOT NULL DEFAULT '[]',
        status text NOT NULL DEFAULT 'received',
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_social_messages_external"
        ON social_messages (tenant_id, platform, external_message_id)
        WHERE external_message_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_social_messages_thread"
        ON social_messages (tenant_id, platform, thread_id, created_at DESC)
    `);

    await queryRunner.query(`
      ALTER TABLE comment_replies
        ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS reactions jsonb NOT NULL DEFAULT '[]'
    `);

    await queryRunner.query(`
      ALTER TABLE whatsapp_messages
        ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS reactions jsonb NOT NULL DEFAULT '[]'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE whatsapp_messages DROP COLUMN IF EXISTS reactions`);
    await queryRunner.query(`ALTER TABLE whatsapp_messages DROP COLUMN IF EXISTS attachments`);
    await queryRunner.query(`ALTER TABLE comment_replies DROP COLUMN IF EXISTS reactions`);
    await queryRunner.query(`ALTER TABLE comment_replies DROP COLUMN IF EXISTS attachments`);
    await queryRunner.query(`DROP TABLE IF EXISTS social_messages`);
  }
}
