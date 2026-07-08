import { Injectable } from '@nestjs/common';
import { MistralChatService } from '../../ai/services/mistral-chat.service';
import { AiUsageTrackerService } from '../../ai/services/ai-usage-tracker.service';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';

@Injectable()
export class LeadClassifyService {
  constructor(
    private readonly mistral: MistralChatService,
    private readonly usage: AiUsageTrackerService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async classify(params: {
    tenantId: string;
    userId?: string;
    name: string;
    email: string;
    message: string;
  }) {
    await this.subscriptions.assertCanUseAi(params.tenantId);

    const { data, tokensUsed } = await this.mistral.completeJson<{
      label?: string;
      suggestedReply?: string;
    }>(
      [
        {
          role: 'system',
          content:
            'Classify inbound leads as hot, warm, or cold. Return JSON: {"label":"hot|warm|cold","suggestedReply":"short reply"}',
        },
        {
          role: 'user',
          content: `Name: ${params.name}\nEmail: ${params.email}\nMessage: ${params.message}`,
        },
      ],
      { model: this.mistral.defaultModel },
    );

    await this.usage.record({
      tenantId: params.tenantId,
      userId: params.userId ?? params.tenantId,
      functionName: 'lead-classify',
      tokensUsed,
    });

    return {
      label: data.label ?? 'warm',
      suggestedReply: data.suggestedReply ?? '',
    };
  }
}
