import { MigrationInterface, QueryRunner } from 'typeorm';

export class TenantMemberInvitations1717920000011 implements MigrationInterface {
  name = 'TenantMemberInvitations1717920000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_member_invitations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        email text NOT NULL,
        role_id uuid NOT NULL,
        invited_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status text NOT NULL DEFAULT 'pending',
        expires_at timestamptz NOT NULL,
        accepted_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tenant_member_invitations_tenant_email"
        ON tenant_member_invitations (tenant_id, email)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tenant_member_invitations_email_status"
        ON tenant_member_invitations (email, status)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tenant_member_invitations_email_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tenant_member_invitations_tenant_email"`);
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_member_invitations`);
  }
}
