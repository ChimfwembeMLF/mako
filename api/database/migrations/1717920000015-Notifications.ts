import { MigrationInterface, QueryRunner } from 'typeorm';

export class Notifications1717920000015 implements MigrationInterface {
  name = 'Notifications1717920000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL,
        user_id uuid NOT NULL,
        type varchar(64) NOT NULL,
        title varchar(255) NOT NULL,
        body text NOT NULL,
        link varchar(512),
        read boolean NOT NULL DEFAULT false,
        email_sent boolean NOT NULL DEFAULT false,
        metadata jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_tenant_created
        ON notifications (user_id, tenant_id, created_at DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
        ON notifications (user_id, tenant_id) WHERE read = false
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        user_id uuid NOT NULL,
        tenant_id uuid NOT NULL,
        email_publish_success boolean NOT NULL DEFAULT true,
        email_billing boolean NOT NULL DEFAULT true,
        email_weekly_digest boolean NOT NULL DEFAULT true,
        email_hot_leads boolean NOT NULL DEFAULT true,
        in_app_enabled boolean NOT NULL DEFAULT true,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, tenant_id)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS notification_preferences`);
    await queryRunner.query(`DROP TABLE IF EXISTS notifications`);
  }
}
