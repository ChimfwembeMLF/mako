import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatbotRag1717920000016 implements MigrationInterface {
  name = 'ChatbotRag1717920000016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    let pgvector = false;
    await queryRunner.query(`SAVEPOINT sp_pgvector`);
    try {
      await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);
      pgvector = true;
      await queryRunner.query(`RELEASE SAVEPOINT sp_pgvector`);
    } catch {
      await queryRunner.query(`ROLLBACK TO SAVEPOINT sp_pgvector`);
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chatbot_configs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL,
        brand_profile_id uuid,
        name varchar(120) NOT NULL DEFAULT 'Website Assistant',
        welcome_message text,
        system_prompt_extra text,
        model varchar(64) DEFAULT 'mistral-small-latest',
        temperature real DEFAULT 0.3,
        max_context_messages int DEFAULT 20,
        rag_enabled boolean DEFAULT true,
        rag_top_k int DEFAULT 6,
        rag_min_score real DEFAULT 0.72,
        widget_enabled boolean DEFAULT false,
        widget_theme jsonb,
        allowed_origins text[],
        is_active boolean DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (tenant_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chatbot_api_keys (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL,
        config_id uuid NOT NULL REFERENCES chatbot_configs(id) ON DELETE CASCADE,
        key_prefix varchar(16) NOT NULL,
        key_hash varchar(128) NOT NULL,
        label varchar(80),
        last_used_at timestamptz,
        revoked_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_chatbot_keys_prefix
        ON chatbot_api_keys(key_prefix) WHERE revoked_at IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS knowledge_documents (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL,
        uploaded_by uuid NOT NULL,
        title varchar(255) NOT NULL,
        source_type varchar(32) NOT NULL DEFAULT 'upload',
        mime_type varchar(128),
        storage_url text,
        file_size_bytes bigint,
        status varchar(32) DEFAULT 'pending',
        error_message text,
        chunk_count int DEFAULT 0,
        metadata jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_docs_tenant
        ON knowledge_documents(tenant_id, status)
    `);

    const embeddingCol = pgvector ? 'embedding vector(1024)' : 'embedding text';
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL,
        document_id uuid NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
        chunk_index int NOT NULL,
        content text NOT NULL,
        token_count int,
        ${embeddingCol},
        metadata jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_chunks_tenant_doc
        ON knowledge_chunks(tenant_id, document_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL,
        config_id uuid NOT NULL REFERENCES chatbot_configs(id),
        channel varchar(32) NOT NULL,
        visitor_id varchar(64),
        user_id uuid,
        title varchar(255),
        metadata jsonb,
        last_message_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_sessions_tenant
        ON chat_sessions(tenant_id, last_message_at DESC NULLS LAST)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL,
        session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
        role varchar(16) NOT NULL,
        content text NOT NULL,
        citations jsonb,
        tokens_used int,
        model varchar(64),
        latency_ms int,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_messages_session
        ON chat_messages(session_id, created_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS chat_messages`);
    await queryRunner.query(`DROP TABLE IF EXISTS chat_sessions`);
    await queryRunner.query(`DROP TABLE IF EXISTS knowledge_chunks`);
    await queryRunner.query(`DROP TABLE IF EXISTS knowledge_documents`);
    await queryRunner.query(`DROP TABLE IF EXISTS chatbot_api_keys`);
    await queryRunner.query(`DROP TABLE IF EXISTS chatbot_configs`);
  }
}
