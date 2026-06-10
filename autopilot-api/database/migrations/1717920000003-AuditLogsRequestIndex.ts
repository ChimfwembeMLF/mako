import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuditLogsRequestIndex1717920000003 implements MigrationInterface {
  name = 'AuditLogsRequestIndex1717920000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_tenant_id_created_at"`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_tenant_id_created_at"
        ON audit_logs (tenant_id, created_at DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_user_id_created_at"
        ON audit_logs (user_id, created_at DESC)
    `);
    await queryRunner.query(`ALTER TABLE audit_logs ALTER COLUMN tenant_id DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE audit_logs ALTER COLUMN user_id DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE audit_logs ALTER COLUMN resource_id DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_user_id_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_tenant_id_created_at"`);
  }
}
