import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatbotFixes1717920000017 implements MigrationInterface {
  name = 'ChatbotFixes1717920000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE chatbot_api_keys
        ALTER COLUMN key_prefix TYPE varchar(32)
    `);

    await queryRunner.query(`
      ALTER TABLE knowledge_chunks
        ADD COLUMN IF NOT EXISTS embedding text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE chatbot_api_keys
        ALTER COLUMN key_prefix TYPE varchar(16)
    `);
  }
}
