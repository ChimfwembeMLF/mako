import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Mistral } from '@mistralai/mistralai';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantIntegrationConfig, IntegrationProvider } from '../../tenants/entities/tenant-integration-config.entity';
import { EncryptionService } from '../../tenants/services/encryption.service';
import { PlatformIntegrationsService } from '../../system_settings/services/platform-integrations.service';

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

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(TenantIntegrationConfig)
    private readonly configRepo: Repository<TenantIntegrationConfig>,
    private readonly encryptionService: EncryptionService,
    private readonly integrations: PlatformIntegrationsService,
  ) {}

  async isEnabled(tenantId?: string): Promise<boolean> {
    if (tenantId) {
      const customConfig = await this.configRepo.findOne({
        where: { tenantId, provider: IntegrationProvider.MISTRAL },
      });
      if (customConfig) return true;
    }
    const fallbackKey = await this.integrations.getIntegrationWithEnvFallback('MISTRAL_API_KEY');
    return Boolean(fallbackKey?.trim());
  }

  private async getClient(tenantId?: string): Promise<Mistral> {
    let resolvedKey = '';

    if (tenantId) {
      try {
        const customConfig = await this.configRepo.findOne({
          where: { tenantId, provider: IntegrationProvider.MISTRAL },
        });

        if (customConfig) {
          resolvedKey = this.encryptionService.decrypt(
            customConfig.encryptedApiKey,
            customConfig.iv,
            customConfig.authTag,
          ).trim();
        }
      } catch (err) {
        this.logger.error(`Failed to load custom Mistral key for tenant ${tenantId}`, err);
      }
    }

    if (!resolvedKey) {
      const fallbackKey = await this.integrations.getIntegrationWithEnvFallback('MISTRAL_API_KEY');
      if (!fallbackKey?.trim()) {
        throw new ServiceUnavailableException('MISTRAL_API_KEY is not configured');
      }
      resolvedKey = fallbackKey.trim();
    }

    return new Mistral({ apiKey: resolvedKey });
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
    tenantId?: string;
  }): Promise<WorkflowExecutionRef> {
    const client = await this.getClient(params.tenantId);
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
      `Workflow ${params.workflowIdentifier} started (execution=${
        ref.executionId ?? 'pending'
      })`,
    );
    return ref;
  }

  async escalateSupport(
    input: SupportEscalationInput,
  ): Promise<WorkflowExecutionRef> {
    const supportEmail =
      input.supportEmail?.trim() ||
      this.config.get<string>('SUPPORT_EMAIL')?.trim() ||
      undefined;

    return this.executeWorkflow({
      workflowIdentifier: 'support-escalation',
      tenantId: input.tenantId,
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
