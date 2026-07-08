import { MigrationInterface, QueryRunner } from 'typeorm';

export class KnowledgeChunkEmbedding1717920000018 implements MigrationInterface {
  name = 'KnowledgeChunkEmbedding1717920000018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE knowledge_chunks
        ADD COLUMN IF NOT EXISTS embedding text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE knowledge_chunks DROP COLUMN IF EXISTS embedding
    `);
  }
}
