import { MigrationInterface, QueryRunner } from 'typeorm';

export class GmailInboxAutoReply1783200000000 implements MigrationInterface {
  name = 'GmailInboxAutoReply1783200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS gmail_inbox_connections (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
        history_id text,
        last_synced_at timestamptz,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_gmail_inbox_connections_tenant_user"
        ON gmail_inbox_connections (tenant_id, user_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_gmail_inbox_connections_active"
        ON gmail_inbox_connections (is_active, last_synced_at)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS mail_messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
        gmail_message_id text NOT NULL,
        thread_id text,
        from_email text NOT NULL,
        subject text,
        body text NOT NULL,
        direction text NOT NULL,
        status text NOT NULL DEFAULT 'inbound',
        rule_id uuid REFERENCES auto_reply_rules(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_mail_messages_gmail_message_id"
        ON mail_messages (gmail_message_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mail_messages_tenant_created"
        ON mail_messages (tenant_id, created_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_mail_messages_tenant_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_mail_messages_gmail_message_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS mail_messages`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_gmail_inbox_connections_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_gmail_inbox_connections_tenant_user"`);
    await queryRunner.query(`DROP TABLE IF EXISTS gmail_inbox_connections`);
  }
}
