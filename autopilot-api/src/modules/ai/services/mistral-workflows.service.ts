import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Mistral } from '@mistralai/mistralai';

export interface SupportEscalationInput {
  tenantId: string;
  sessionId: string;
  botName?: string;
  userMessage: string;
  transcript?: string;
  supportEmail?: string;
  visitorEmail?: string;
}

export interface WorkflowExecutionRef {
  executionId?: string;
  status?: string;
  result?: unknown;
}

@Injectable()
export class MistralWorkflowsService {
  private readonly logger = new Logger(MistralWorkflowsService.name);
  private client: Mistral | null = null;

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return Boolean(this.config.get<string>('MISTRAL_API_KEY')?.trim());
  }

  private getClient(): Mistral {
    const apiKey = this.config.get<string>('MISTRAL_API_KEY');
    if (!apiKey?.trim()) {
      throw new ServiceUnavailableException('MISTRAL_API_KEY is not configured');
    }
    if (!this.client) {
      this.client = new Mistral({ apiKey: apiKey.trim() });
    }
    return this.client;
  }

  private deploymentName(): string {
    return (
      this.config.get<string>('MISTRAL_WORKFLOWS_DEPLOYMENT_NAME')?.trim() ||
      'default'
    );
  }

  async executeWorkflow(params: {
    workflowIdentifier: string;
    input: Record<string, unknown>;
    executionId?: string;
    waitForResult?: boolean;
    timeoutSeconds?: number;
  }): Promise<WorkflowExecutionRef> {
    const client = this.getClient();
    const response = await client.workflows.executeWorkflow({
      workflowIdentifier: params.workflowIdentifier,
      workflowExecutionRequest: {
        input: params.input,
        executionId: params.executionId,
        waitForResult: params.waitForResult ?? false,
        timeoutSeconds: params.timeoutSeconds,
        deploymentName: this.deploymentName(),
      },
    });

    const ref: WorkflowExecutionRef = {
      executionId:
        (response as { executionId?: string }).executionId ??
        (response as { id?: string }).id,
      status: (response as { status?: string }).status,
      result: (response as { result?: unknown }).result,
    };
    this.logger.log(
      `Workflow ${params.workflowIdentifier} started (execution=${ref.executionId ?? 'pending'})`,
    );
    return ref;
  }

  async escalateSupport(input: SupportEscalationInput): Promise<WorkflowExecutionRef> {
    const supportEmail =
      input.supportEmail?.trim() ||
      this.config.get<string>('SUPPORT_EMAIL')?.trim() ||
      undefined;

    return this.executeWorkflow({
      workflowIdentifier: 'support-escalation',
      executionId: `escalation-${input.tenantId}-${input.sessionId}`,
      input: {
        tenant_id: input.tenantId,
        session_id: input.sessionId,
        bot_name: input.botName ?? 'Website Assistant',
        user_message: input.userMessage,
        transcript: input.transcript ?? '',
        support_email: supportEmail ?? null,
        visitor_email: input.visitorEmail ?? null,
      },
    });
  }
}
