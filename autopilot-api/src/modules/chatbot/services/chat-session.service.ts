import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatSession, ChatChannel } from '../entities/chat-session.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { ChatbotConfig } from '../entities/chatbot-config.entity';
import { ChatbotConfigService } from './chatbot-config.service';
import { RagOrchestratorService } from './rag-orchestrator.service';
import { scopeWhere } from '../../../common/workspace-scope.util';
import {
  MistralWorkflowsService,
  WorkflowExecutionRef,
} from '../../ai/services/mistral-workflows.service';

@Injectable()
export class ChatSessionService {
  constructor(
    @InjectRepository(ChatSession)
    private readonly sessionRepo: Repository<ChatSession>,
    @InjectRepository(ChatMessage)
    private readonly messageRepo: Repository<ChatMessage>,
    private readonly configService: ChatbotConfigService,
    private readonly rag: RagOrchestratorService,
    private readonly workflows: MistralWorkflowsService,
  ) {}

  async listSessions(
    tenantId: string,
    channel?: ChatChannel,
    workspaceId?: string,
  ): Promise<ChatSession[]> {
    const where = scopeWhere<ChatSession>(tenantId, workspaceId) as {
      tenantId: string;
      workspaceId?: string;
      channel?: ChatChannel;
    };
    if (channel) where.channel = channel;
    return this.sessionRepo.find({
      where,
      order: { lastMessageAt: 'DESC', created_at: 'DESC' },
      take: 100,
    });
  }

  async getSession(tenantId: string, sessionId: string): Promise<ChatSession> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, tenantId },
    });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  async getMessages(
    tenantId: string,
    sessionId: string,
  ): Promise<ChatMessage[]> {
    await this.getSession(tenantId, sessionId);
    return this.messageRepo.find({
      where: { sessionId, tenantId },
      order: { created_at: 'ASC' },
    });
  }

  async getAssistantMessage(
    tenantId: string,
    sessionId: string,
    messageId: string,
  ): Promise<ChatMessage> {
    await this.getSession(tenantId, sessionId);
    const message = await this.messageRepo.findOne({
      where: { id: messageId, sessionId, tenantId },
    });
    if (!message) throw new NotFoundException('Message not found');
    if (message.role !== 'assistant') {
      throw new BadRequestException('Only assistant messages can be spoken');
    }
    return message;
  }

  async createSession(params: {
    tenantId: string;
    config: ChatbotConfig;
    channel: ChatChannel;
    userId?: string;
    visitorId?: string;
    title?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ChatSession> {
    const session = this.sessionRepo.create({
      tenantId: params.tenantId,
      workspaceId: params.config.workspaceId,
      configId: params.config.id,
      channel: params.channel,
      userId: params.userId,
      visitorId: params.visitorId,
      title: params.title,
      metadata: params.metadata,
      lastMessageAt: new Date(),
    });
    const saved = await this.sessionRepo.save(session);

    let welcomeMessageId: string | undefined;
    if (params.config.welcomeMessage?.trim()) {
      const welcome = await this.messageRepo.save(
        this.messageRepo.create({
          tenantId: params.tenantId,
          sessionId: saved.id,
          role: 'assistant',
          content: params.config.welcomeMessage.trim(),
        }),
      );
      welcomeMessageId = welcome.id;
    }

    return Object.assign(saved, { welcomeMessageId });
  }

  async deleteSession(tenantId: string, sessionId: string): Promise<void> {
    await this.getSession(tenantId, sessionId);
    await this.sessionRepo.delete({ id: sessionId, tenantId });
  }

  async sendMessage(params: {
    tenantId: string;
    sessionId: string;
    userId: string;
    content: string;
    config?: ChatbotConfig;
  }): Promise<{ userMessage: ChatMessage; assistantMessage: ChatMessage }> {
    const session = await this.getSession(params.tenantId, params.sessionId);
    const config =
      params.config ?? (await this.configService.getOrCreate(params.tenantId));

    const userMessage = await this.messageRepo.save(
      this.messageRepo.create({
        tenantId: params.tenantId,
        sessionId: params.sessionId,
        role: 'user',
        content: params.content,
      }),
    );

    if (!session.title && params.content.length > 0) {
      session.title = params.content.slice(0, 80);
      await this.sessionRepo.save(session);
    }

    const reply = await this.rag.generateReply({
      tenantId: params.tenantId,
      userId: params.userId,
      config,
      sessionId: params.sessionId,
      userMessage: params.content,
    });

    const assistantMessage = await this.messageRepo.save(
      this.messageRepo.create({
        tenantId: params.tenantId,
        sessionId: params.sessionId,
        role: 'assistant',
        content: reply.content,
        citations: reply.citations,
        tokensUsed: reply.tokensUsed,
        model: reply.model,
        latencyMs: reply.latencyMs,
      }),
    );

    session.lastMessageAt = new Date();
    await this.sessionRepo.save(session);

    return { userMessage, assistantMessage };
  }

  async escalateSession(params: {
    tenantId: string;
    sessionId: string;
    userMessage: string;
    visitorEmail?: string;
  }): Promise<WorkflowExecutionRef> {
    if (!this.workflows.isEnabled()) {
      throw new ServiceUnavailableException(
        'Mistral Workflows is not configured (MISTRAL_API_KEY required)',
      );
    }

    await this.getSession(params.tenantId, params.sessionId);
    const config = await this.configService.getOrCreate(params.tenantId);
    const messages = await this.getMessages(params.tenantId, params.sessionId);
    const transcript = messages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    return this.workflows.escalateSupport({
      tenantId: params.tenantId,
      sessionId: params.sessionId,
      botName: config.name,
      userMessage: params.userMessage,
      transcript,
      visitorEmail: params.visitorEmail,
    });
  }
}
