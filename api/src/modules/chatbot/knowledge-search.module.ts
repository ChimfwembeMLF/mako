import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { SystemSettingsModule } from '../system_settings/system_settings.module';
import { QdrantService } from './services/qdrant.service';
import { KnowledgeEmbeddingService } from './services/knowledge-embedding.service';
import { VectorStoreService } from './services/vector-store.service';

/**
 * Searching a workspace's uploaded documents. Kept separate from ChatbotModule so
 * other features (WhatsApp agents) can use it without importing the whole chatbot.
 */
@Module({
  imports: [AiModule, SystemSettingsModule],
  providers: [QdrantService, KnowledgeEmbeddingService, VectorStoreService],
  exports: [QdrantService, KnowledgeEmbeddingService, VectorStoreService],
})
export class KnowledgeSearchModule {}
