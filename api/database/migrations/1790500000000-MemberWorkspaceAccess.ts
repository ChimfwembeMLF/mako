import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets a member (or a pending invitation) be limited to some of the organization's
 * workspaces. NULL means every workspace, so existing members keep their access.
 */
export class MemberWorkspaceAccess1790500000000 implements MigrationInterface {
  name = 'MemberWorkspaceAccess1790500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tenant_members" ADD "workspace_ids" uuid array`);
    await queryRunner.query(`ALTER TABLE "tenant_member_invitations" ADD "workspace_ids" uuid array`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tenant_member_invitations" DROP COLUMN "workspace_ids"`);
    await queryRunner.query(`ALTER TABLE "tenant_members" DROP COLUMN "workspace_ids"`);
  }
}
