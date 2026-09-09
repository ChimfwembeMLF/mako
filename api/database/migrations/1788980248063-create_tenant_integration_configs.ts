import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTenantIntegrationConfigs1788980248063 implements MigrationInterface {
    name = 'CreateTenantIntegrationConfigs1788980248063'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "tenant_integration_configs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "provider" character varying NOT NULL, "encrypted_api_key" text NOT NULL, "iv" character varying NOT NULL, "auth_tag" character varying NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_0534bba5ef9aab9ae9bfdf62a17" UNIQUE ("tenant_id", "provider"), CONSTRAINT "PK_19658f8941f2288471d6d904a77" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "tenant_integration_configs" ADD CONSTRAINT "FK_fb27662c943843882e71a45c1cf" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tenant_integration_configs" DROP CONSTRAINT "FK_fb27662c943843882e71a45c1cf"`);
        await queryRunner.query(`DROP TABLE "tenant_integration_configs"`);
    }

}
