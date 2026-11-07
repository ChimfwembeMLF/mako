import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Separates the read-aloud voice from the chat AI provider. Workspaces that picked the
 * self-hosted voice had it stored as their AI provider, which left chat on the default.
 */
export class TenantVoiceProvider1790400000000 implements MigrationInterface {
  name = 'TenantVoiceProvider1790400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "preferred_tts_provider" text`);
    await queryRunner.query(`
      UPDATE "tenants"
      SET "preferred_tts_provider" = 'self_hosted_parler', "preferred_ai_provider" = NULL
      WHERE "preferred_ai_provider"::text = 'self_hosted_parler'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "tenants"
      SET "preferred_ai_provider" = 'self_hosted_parler'
      WHERE "preferred_tts_provider" = 'self_hosted_parler' AND "preferred_ai_provider" IS NULL`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "preferred_tts_provider"`);
  }
}
