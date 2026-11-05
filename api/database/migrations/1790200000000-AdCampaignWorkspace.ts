import { MigrationInterface, QueryRunner } from "typeorm";

export class AdCampaignWorkspace1790200000000 implements MigrationInterface {
    name = 'AdCampaignWorkspace1790200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ad_campaigns" ADD "workspace_id" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_ad_campaigns_tenant_workspace" ON "ad_campaigns" ("tenant_id", "workspace_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_ad_campaigns_tenant_workspace"`);
        await queryRunner.query(`ALTER TABLE "ad_campaigns" DROP COLUMN "workspace_id"`);
    }

}
