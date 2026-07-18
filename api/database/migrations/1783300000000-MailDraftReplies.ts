import { MigrationInterface, QueryRunner } from 'typeorm';

export class MailDraftReplies1783300000000 implements MigrationInterface {
  name = 'MailDraftReplies1783300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE mail_messages
        ADD COLUMN IF NOT EXISTS to_email text,
        ADD COLUMN IF NOT EXISTS gmail_draft_id text,
        ADD COLUMN IF NOT EXISTS in_reply_to_gmail_message_id text
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_mail_messages_tenant_status_created"
        ON mail_messages (tenant_id, status, created_at DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_mail_messages_tenant_status_created"`,
    );
    await queryRunner.query(`
      ALTER TABLE mail_messages
        DROP COLUMN IF EXISTS in_reply_to_gmail_message_id,
        DROP COLUMN IF EXISTS gmail_draft_id,
        DROP COLUMN IF EXISTS to_email
    `);
  }
}
