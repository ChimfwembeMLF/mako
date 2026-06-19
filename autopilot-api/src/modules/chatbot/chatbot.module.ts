import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AiModule } from '../ai/ai.module';
import { BrandProfilesModule } from '../brand_profiles/brand_profiles.module';
import { MediaModule } from '../media/media.module';
import { QueuesModule } from '../queues/queues.module';
import { RbacModule } from '../auth/rbac/rbac.module';
import { QUEUE_AI } from '../queues/queue.constants';
import { ChatbotConfig } from './entities/chatbot-config.entity';
import { ChatbotTtsVoice } from './entities/chatbot-tts-voice.entity';
import { ChatbotApiKey } from './entities/chatbot-api-key.entity';
import { KnowledgeDocument } from './entities/knowledge-document.entity';
import { KnowledgeChunk } from './entities/knowledge-chunk.entity';
import { ChatSession } from './entities/chat-session.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatbotController } from './chatbot.controller';
import { KnowledgeController } from './knowledge.controller';
import { WidgetController } from './widget.controller';
import { ChatbotConfigService } from './services/chatbot-config.service';
import { ChatSessionService } from './services/chat-session.service';
import { ChatApiKeyService } from './services/chat-api-key.service';
import { ChatbotAccessService } from './services/chatbot-access.service';
import { KnowledgeDocumentService } from './services/knowledge-document.service';
import { KnowledgeIngestService } from './services/knowledge-ingest.service';
import { VectorStoreService } from './services/vector-store.service';
import { RagOrchestratorService } from './services/rag-orchestrator.service';
import { MistralChatbotLibraryService } from './services/mistral-chatbot-library.service';
import { ChatbotTtsVoiceService } from './services/chatbot-tts-voice.service';
import { WidgetApiKeyGuard } from './guards/widget-api-key.guard';
import { ChatbotWidgetSeedService } from './chatbot-widget-seed.service';
import { WidgetSuggestionsService } from './services/widget-suggestions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChatbotConfig,
      ChatbotTtsVoice,
      ChatbotApiKey,
      KnowledgeDocument,
      KnowledgeChunk,
      ChatSession,
      ChatMessage,
    ]),
    BullModule.registerQueue({ name: QUEUE_AI }),
    AiModule,
    BrandProfilesModule,
    MediaModule,
    forwardRef(() => QueuesModule),
    RbacModule,
  ],
  controllers: [ChatbotController, KnowledgeController, WidgetController],
  providers: [
    ChatbotConfigService,
    ChatSessionService,
    ChatApiKeyService,
    ChatbotAccessService,
    KnowledgeDocumentService,
    KnowledgeIngestService,
    VectorStoreService,
    RagOrchestratorService,
    MistralChatbotLibraryService,
    ChatbotTtsVoiceService,
    WidgetApiKeyGuard,
    ChatbotWidgetSeedService,
    WidgetSuggestionsService,
  ],
  exports: [
    ChatbotConfigService,
    KnowledgeIngestService,
    ChatbotWidgetSeedService,
  ],
})
export class ChatbotModule {}
