import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatbotTtsVoices1717920000022 implements MigrationInterface {
  name = 'ChatbotTtsVoices1717920000022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chatbot_tts_voices (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL,
        mistral_voice_id varchar(64) NOT NULL,
        name varchar(120) NOT NULL,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (tenant_id, mistral_voice_id)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_chatbot_tts_voices_tenant
        ON chatbot_tts_voices(tenant_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS chatbot_tts_voices`);
  }
}
