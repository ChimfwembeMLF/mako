import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Everyone who messages or comments becomes a lead. Leads remember who they are on the
 * channel they came from, and comments remember who wrote them.
 */
export class LeadCaptureFromInbox1790700000000 implements MigrationInterface {
  name = 'LeadCaptureFromInbox1790700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "leads" ADD "external_ref" text`);
    await queryRunner.query(`ALTER TABLE "leads" ADD "avatar_url" text`);
    await queryRunner.query(`ALTER TABLE "leads" ADD "last_message_at" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`CREATE INDEX "IDX_leads_external_ref" ON "leads" ("external_ref")`);
    await queryRunner.query(`ALTER TABLE "comment_replies" ADD "commenter_id" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "comment_replies" DROP COLUMN "commenter_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_leads_external_ref"`);
    await queryRunner.query(`ALTER TABLE "leads" DROP COLUMN "last_message_at"`);
    await queryRunner.query(`ALTER TABLE "leads" DROP COLUMN "avatar_url"`);
    await queryRunner.query(`ALTER TABLE "leads" DROP COLUMN "external_ref"`);
  }
}
