import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPhoneVerification1790100000000 implements MigrationInterface {
    name = 'AddPhoneVerification1790100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "phone_verified_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "users" ADD "pending_phone" text`);
        await queryRunner.query(`ALTER TABLE "users" ADD "phone_code_hash" text`);
        await queryRunner.query(`ALTER TABLE "users" ADD "phone_code_purpose" text`);
        await queryRunner.query(`ALTER TABLE "users" ADD "phone_code_expires_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "users" ADD "phone_code_attempts" integer NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "users" ADD "phone_code_sent_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "users" ADD "phone_code_window_start" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "users" ADD "phone_code_send_count" integer NOT NULL DEFAULT 0`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_users_verified_phone" ON "users" ("phone") WHERE "phone_verified_at" IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "UQ_users_verified_phone"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "phone_code_send_count"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "phone_code_window_start"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "phone_code_sent_at"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "phone_code_attempts"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "phone_code_expires_at"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "phone_code_purpose"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "phone_code_hash"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "pending_phone"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "phone_verified_at"`);
    }

}
