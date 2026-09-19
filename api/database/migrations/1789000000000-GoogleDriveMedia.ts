import { MigrationInterface, QueryRunner } from 'typeorm';

export class GoogleDriveMedia1789000000000 implements MigrationInterface {
  name = 'GoogleDriveMedia1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // await queryRunner.query(
    //   `ALTER TABLE "media_assets" ADD "source" character varying DEFAULT 'local'`,
    // );
    // await queryRunner.query(
    //   `ALTER TABLE "media_assets" ADD "external_id" character varying`,
    // );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "media_assets" DROP COLUMN "external_id"`);
    await queryRunner.query(`ALTER TABLE "media_assets" DROP COLUMN "source"`);
  }
}
