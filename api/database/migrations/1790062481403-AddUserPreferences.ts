import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserPreferences1790062481403 implements MigrationInterface {
    name = 'AddUserPreferences1790062481403'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "preferences" jsonb NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`ALTER TABLE "whatsapp_flow_configs" ALTER COLUMN "welcome_triggers" SET DEFAULT ARRAY['hi','hello','menu','start','0']`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "whatsapp_flow_configs" ALTER COLUMN "welcome_triggers" SET DEFAULT ARRAY['hi', 'hello', 'menu', 'start', '0'`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "preferences"`);
    }

}
