import { MigrationInterface, QueryRunner } from "typeorm";

export class ParlerVoiceDescription1790017964757 implements MigrationInterface {
    name = 'ParlerVoiceDescription1790017964757'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "content_publications" DROP CONSTRAINT "FK_ec01e643a3b192f22bcc2c0c64c"`);
        await queryRunner.query(`ALTER TABLE "media_assets" DROP CONSTRAINT "FK_4a6f84a968384fc2d31a25ce11d"`);
        await queryRunner.query(`ALTER TABLE "comment_replies" DROP CONSTRAINT "FK_93c2fee05629112ffc716cce36d"`);
        await queryRunner.query(`ALTER TABLE "chatbot_configs" ADD "parler_voice_description" text`);
        await queryRunner.query(`ALTER TYPE "public"."tenants_preferred_ai_provider_enum" RENAME TO "tenants_preferred_ai_provider_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."tenants_preferred_ai_provider_enum" AS ENUM('openai', 'gemini', 'mistral', 'deepseek', 'google_drive', 'self_hosted_parler')`);
        await queryRunner.query(`ALTER TABLE "tenants" ALTER COLUMN "preferred_ai_provider" TYPE "public"."tenants_preferred_ai_provider_enum" USING "preferred_ai_provider"::"text"::"public"."tenants_preferred_ai_provider_enum"`);
        await queryRunner.query(`DROP TYPE "public"."tenants_preferred_ai_provider_enum_old"`);
        await queryRunner.query(`ALTER TABLE "whatsapp_flow_configs" ALTER COLUMN "welcome_triggers" SET DEFAULT ARRAY['hi','hello','menu','start','0']`);
        await queryRunner.query(`ALTER TABLE "content_items" ALTER COLUMN "approval_reminder_sent" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "content_publications" ADD CONSTRAINT "FK_ec01e643a3b192f22bcc2c0c64c" FOREIGN KEY ("content_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "media_assets" ADD CONSTRAINT "FK_4a6f84a968384fc2d31a25ce11d" FOREIGN KEY ("content_id") REFERENCES "content_items"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comment_replies" ADD CONSTRAINT "FK_93c2fee05629112ffc716cce36d" FOREIGN KEY ("content_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comment_replies" DROP CONSTRAINT "FK_93c2fee05629112ffc716cce36d"`);
        await queryRunner.query(`ALTER TABLE "media_assets" DROP CONSTRAINT "FK_4a6f84a968384fc2d31a25ce11d"`);
        await queryRunner.query(`ALTER TABLE "content_publications" DROP CONSTRAINT "FK_ec01e643a3b192f22bcc2c0c64c"`);
        await queryRunner.query(`ALTER TABLE "content_items" ALTER COLUMN "approval_reminder_sent" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "whatsapp_flow_configs" ALTER COLUMN "welcome_triggers" SET DEFAULT ARRAY['hi', 'hello', 'menu', 'start', '0'`);
        await queryRunner.query(`CREATE TYPE "public"."tenants_preferred_ai_provider_enum_old" AS ENUM('openai', 'gemini', 'mistral', 'deepseek', 'google_drive')`);
        await queryRunner.query(`ALTER TABLE "tenants" ALTER COLUMN "preferred_ai_provider" TYPE "public"."tenants_preferred_ai_provider_enum_old" USING "preferred_ai_provider"::"text"::"public"."tenants_preferred_ai_provider_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."tenants_preferred_ai_provider_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."tenants_preferred_ai_provider_enum_old" RENAME TO "tenants_preferred_ai_provider_enum"`);
        await queryRunner.query(`ALTER TABLE "chatbot_configs" DROP COLUMN "parler_voice_description"`);
        await queryRunner.query(`ALTER TABLE "comment_replies" ADD CONSTRAINT "FK_93c2fee05629112ffc716cce36d" FOREIGN KEY ("content_id") REFERENCES "content_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "media_assets" ADD CONSTRAINT "FK_4a6f84a968384fc2d31a25ce11d" FOREIGN KEY ("content_id") REFERENCES "content_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "content_publications" ADD CONSTRAINT "FK_ec01e643a3b192f22bcc2c0c64c" FOREIGN KEY ("content_id") REFERENCES "content_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
