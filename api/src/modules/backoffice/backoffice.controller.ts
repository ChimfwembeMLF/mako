import { Controller, Get, HttpCode, Param, Patch, Body, UseGuards, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { BackofficeService } from './backoffice.service';
import { UpdatePlansDto } from '../subscriptions/dto/update-plans.dto';
import { SendTestSmsDto } from '../sms/send-test-sms.dto';
import { SmsService } from '../sms/sms.service';
import { MistralChatService } from '../ai/services/mistral-chat.service';
import { AiProviderRouter } from '../ai/services/ai-provider-router.service';
import { KnowledgeDocumentService } from '../chatbot/services/knowledge-document.service';
import { QdrantService } from '../chatbot/services/qdrant.service';
import { KnowledgeEmbeddingService } from '../chatbot/services/knowledge-embedding.service';

@ApiTags('Backoffice')
@Controller('api/v1/backoffice')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@ApiBearerAuth()
export class BackofficeController {
  constructor(
    private readonly backoffice: BackofficeService,
    private readonly sms: SmsService,
    private readonly mistral: MistralChatService,
    private readonly aiRouter: AiProviderRouter,
    private readonly knowledgeDocs: KnowledgeDocumentService,
    private readonly qdrant: QdrantService,
    private readonly knowledgeEmbeddings: KnowledgeEmbeddingService,
  ) {}

  /** Which engines answer chats and index documents, and whether the vector database is reachable. */
  @Get('ai/status')
  async aiStatus() {
    const [defaultProvider, embedProvider, embedModel, collection, qdrantConfigured, documents] = await Promise.all([
      this.aiRouter.getPlatformDefault(),
      this.knowledgeEmbeddings.provider(),
      this.knowledgeEmbeddings.model(),
      this.knowledgeEmbeddings.collection(),
      this.qdrant.isConfigured(),
      this.knowledgeDocs.statusCounts(),
    ]);
    const qdrant = qdrantConfigured ? await this.qdrant.status(collection) : null;
    return { defaultProvider, embedProvider, embedModel, collection, qdrantConfigured, qdrant, documents };
  }

  /** Re-processes every knowledge document into the current vector store and embedding model. */
  @Post('knowledge/reindex')
  @HttpCode(202)
  reindexKnowledge(@Req() req: { user: { sub: string } }) {
    return this.knowledgeDocs.reindexAll(String(req.user.sub));
  }

  /** Calls Mistral with the platform key (Integrations first, then the server environment). */
  @Post('integrations/mistral/test')
  @HttpCode(200)
  async testMistral(): Promise<{ ok: boolean; message?: string }> {
    try {
      const { ok } = await this.mistral.healthCheck();
      return ok ? { ok } : { ok, message: 'Mistral answered, but not as expected.' };
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const message = /401|unauthori[sz]ed|invalid api key/i.test(raw)
        ? 'Mistral rejected the key. Create a new key at console.mistral.ai and save it under Integrations.'
        : raw;
      return { ok: false, message };
    }
  }

  @Post('sms/test')
  @HttpCode(202)
  sendTestSms(@Body() dto: SendTestSmsDto) {
    return this.sms.send({ to: dto.to, message: dto.message });
  }

  @Get('overview')
  overview() {
    return this.backoffice.getOverview();
  }

  @Get('subscriptions')
  listSubscriptions() {
    return this.backoffice.listSubscriptions();
  }

  @Get('tenants')
  tenants() {
    return this.backoffice.listTenants();
  }

  @Get('tenants/:id')
  tenantDetail(@Param('id') id: string) {
    return this.backoffice.getTenantDetail(id);
  }

  @Get('plans')
  plans() {
    return this.backoffice.getPlans();
  }

  @Patch('plans')
  updatePlans(@Body() dto: UpdatePlansDto) {
    return this.backoffice.updatePlans(dto);
  }

  @Get('refunds')
  listRefunds() {
    return this.backoffice.listRefunds();
  }

  @Post('refunds/:id/approve')
  approveRefund(@Param('id') id: string) {
    return this.backoffice.approveRefund(id);
  }

  @Post('refunds/:id/reject')
  rejectRefund(@Param('id') id: string, @Body() body: { notes?: string }) {
    return this.backoffice.rejectRefund(id, body.notes);
  }
}
