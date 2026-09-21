import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiUsageModule } from '../ai_usage/ai_usage.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { BrandProfiles } from '../brand_profiles/entities/brand_profiles.entity';
import { AiController } from './ai.controller';
import { MistralChatService } from './services/mistral-chat.service';
import { OpenAIChatService } from './services/openai-chat.service';
import { GeminiChatService } from './services/gemini-chat.service';
import { DeepseekChatService } from './services/deepseek-chat.service';
import { MistralTtsService } from './services/mistral-tts.service';
import { MistralAgentsService } from './services/mistral-agents.service';
import { PromptBuilderService } from './services/prompt-builder.service';
import { AiUsageTrackerService } from './services/ai-usage-tracker.service';
import { FormSuggestionsService } from './services/form-suggestions.service';
import { MistralWorkflowsService } from './services/mistral-workflows.service';
import { AiProviderRouter } from './services/ai-provider-router.service';
import { ParlerTtsService } from './services/parler-tts.service';
import { SttService } from './services/stt.service';
import { Tenants } from '../tenants/entities/tenants.entity';

import { StorageModule } from '../media/storage.module';
import { TenantIntegrationConfig } from '../tenants/entities/tenant-integration-config.entity';
import { EncryptionService } from '../tenants/services/encryption.service';
import { SystemSettingsModule } from '../system_settings/system_settings.module';

@Module({
  imports: [
    AiUsageModule,
    SubscriptionsModule,
    StorageModule,
    SystemSettingsModule,
    TypeOrmModule.forFeature([BrandProfiles, TenantIntegrationConfig, Tenants]),
  ],
  controllers: [AiController],
  providers: [
    EncryptionService,
    MistralChatService,
    OpenAIChatService,
    GeminiChatService,
    DeepseekChatService,
    MistralTtsService,
    MistralAgentsService,
    PromptBuilderService,
    AiUsageTrackerService,
    FormSuggestionsService,
    MistralWorkflowsService,
    AiProviderRouter,
    ParlerTtsService,
    SttService,
  ],
  exports: [
    MistralChatService,
    OpenAIChatService,
    GeminiChatService,
    DeepseekChatService,
    MistralTtsService,
    MistralAgentsService,
    PromptBuilderService,
    AiUsageTrackerService,
    FormSuggestionsService,
    MistralWorkflowsService,
    AiProviderRouter,
    ParlerTtsService,
    SttService,
  ],
})
export class AiModule {}
