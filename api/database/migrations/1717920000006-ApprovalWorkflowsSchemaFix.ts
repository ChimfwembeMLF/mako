import { MigrationInterface, QueryRunner } from 'typeorm';

export class ApprovalWorkflowsSchemaFix1717920000006 implements MigrationInterface {
  name = 'ApprovalWorkflowsSchemaFix1717920000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE approval_requests
        DROP CONSTRAINT IF EXISTS "FK_09e748be3e6e1232f6b3023e5bc"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS approval_workflows`);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    /* Destructive fix — no automatic rollback */
  }
}
