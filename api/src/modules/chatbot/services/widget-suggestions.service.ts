import { Injectable } from '@nestjs/common';
import { MistralChatService } from '../../ai/services/mistral-chat.service';
import { PromptBuilderService } from '../../ai/services/prompt-builder.service';
import { AiUsageTrackerService } from '../../ai/services/ai-usage-tracker.service';
import { BrandProfilesService } from '../../brand_profiles/brand_profiles.service';
import { brandContextBlock } from '../../ai/prompts/brand-fields';
import { ChatbotConfig } from '../entities/chatbot-config.entity';

const DEFAULT_STARTERS = [
  'What can you help me with?',
  'Tell me about your services',
  'How do I get started?',
];

@Injectable()
export class WidgetSuggestionsService {
  constructor(
    private readonly mistral: MistralChatService,
    private readonly prompts: PromptBuilderService,
    private readonly usage: AiUsageTrackerService,
    private readonly brandProfiles: BrandProfilesService,
  ) {}

  getStarterSuggestions(config: ChatbotConfig): string[] {
    const theme = config.widgetTheme ?? {};
    const fromTheme = theme.starterPrompts;
    if (Array.isArray(fromTheme)) {
      const custom = fromTheme
        .filter(
          (s): s is string => typeof s === 'string' && s.trim().length > 0,
        )
        .map((s) => s.trim())
        .slice(0, 3);
      if (custom.length) return custom;
    }
    return DEFAULT_STARTERS.slice(0, 3);
  }

  async getFollowUpSuggestions(params: {
    tenantId: string;
    config: ChatbotConfig;
    lastAssistantMessage: string;
  }): Promise<string[]> {
    const context = params.lastAssistantMessage.trim();
    if (!context) return this.getStarterSuggestions(params.config);

    await this.usage.assertWithinLimit(params.tenantId, params.tenantId);

    const brand = await this.resolveBrand(params.tenantId, params.config);
    const brandBlock = brandContextBlock(brand);

    try {
      const { data, tokensUsed } = await this.mistral.completeJson<{
        suggestions?: string[];
      }>(
        [
          {
            role: 'system',
            content: `You suggest short chat prompts for a website visitor (max 3).
Return ONLY JSON: { "suggestions": ["...", "...", "..."] }
Each suggestion: under 55 characters, phrased as a natural question or request, no quotes inside strings.`,
          },
          {
            role: 'user',
            content: [
              brandBlock ? `Brand:\n${brandBlock}` : '',
              params.config.welcomeMessage
                ? `Welcome message: ${params.config.welcomeMessage}`
                : '',
              `Assistant just said:\n${context.slice(0, 1200)}`,
              'Suggest 3 logical follow-up prompts the visitor might tap next.',
            ]
              .filter(Boolean)
              .join('\n\n'),
          },
        ],
        { model: this.mistral.defaultModel },
      );

      await this.usage.record({
        tenantId: params.tenantId,
        userId: params.tenantId,
        functionName: 'widget-suggestions',
        tokensUsed,
      });

      const items = Array.isArray(data.suggestions)
        ? data.suggestions
            .filter(
              (s): s is string => typeof s === 'string' && s.trim().length > 0,
            )
            .map((s) => s.trim().slice(0, 55))
            .slice(0, 3)
        : [];
      return items.length ? items : this.getStarterSuggestions(params.config);
    } catch {
      return this.getStarterSuggestions(params.config);
    }
  }

  private async resolveBrand(tenantId: string, config: ChatbotConfig) {
    if (config.brandProfileId) {
      try {
        const profile = await this.brandProfiles.findOne(config.brandProfileId);
        return this.prompts.brandFromEntity(profile);
      } catch {
        /* fall through */
      }
    }
    const profile = await this.brandProfiles.resolveForContext({
      tenantId,
      userId: tenantId,
      workspaceId: config.workspaceId,
    });
    return this.prompts.brandFromEntity(profile);
  }
}
