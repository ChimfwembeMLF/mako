import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPreferredAiProviderToTenants1789763372449 implements MigrationInterface {
    name = 'AddPreferredAiProviderToTenants1789763372449'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."tenants_preferred_ai_provider_enum" AS ENUM('openai', 'gemini', 'mistral', 'deepseek', 'google_drive')`);
        await queryRunner.query(`ALTER TABLE "tenants" ADD "preferred_ai_provider" "public"."tenants_preferred_ai_provider_enum"`);
        await queryRunner.query(`ALTER TABLE "whatsapp_flow_configs" ALTER COLUMN "welcome_triggers" SET DEFAULT ARRAY['hi','hello','menu','start','0']`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "whatsapp_flow_configs" ALTER COLUMN "welcome_triggers" SET DEFAULT ARRAY['hi', 'hello', 'menu', 'start', '0'`);
        await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "preferred_ai_provider"`);
        await queryRunner.query(`DROP TYPE "public"."tenants_preferred_ai_provider_enum"`);
    }

}
