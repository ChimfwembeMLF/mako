import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatbotWidgetTts1717920000021 implements MigrationInterface {
  name = 'ChatbotWidgetTts1717920000021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE chatbot_configs
        ADD COLUMN IF NOT EXISTS widget_tts_enabled boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS mistral_voice_id varchar(64)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE chatbot_configs
        DROP COLUMN IF EXISTS widget_tts_enabled,
        DROP COLUMN IF EXISTS mistral_voice_id
    `);
  }
}
