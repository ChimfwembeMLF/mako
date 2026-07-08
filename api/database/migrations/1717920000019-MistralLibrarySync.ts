import { MigrationInterface, QueryRunner } from 'typeorm';

export class MistralLibrarySync1717920000019 implements MigrationInterface {
  name = 'MistralLibrarySync1717920000019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE chatbot_configs
        ADD COLUMN IF NOT EXISTS use_mistral_library boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS mistral_library_id varchar(64),
        ADD COLUMN IF NOT EXISTS mistral_agent_id varchar(64)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE chatbot_configs
        DROP COLUMN IF EXISTS use_mistral_library,
        DROP COLUMN IF EXISTS mistral_library_id,
        DROP COLUMN IF EXISTS mistral_agent_id
    `);
  }
}
