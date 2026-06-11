import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { randomBytes } from 'crypto';
import type { Response } from 'express';
import { MistralChatService } from '../ai/services/mistral-chat.service';
import { WidgetApiKeyGuard } from './guards/widget-api-key.guard';
import { ChatSessionService } from './services/chat-session.service';
import { CreateWidgetSessionDto, SendMessageDto } from './dto/send-message.dto';
import {
  AssistantMessageResponseDto,
  CreateWidgetSessionResponseDto,
  WidgetConfigResponseDto,
} from './dto/widget-response.dto';
import type { ApiKeyValidation } from './services/chat-api-key.service';
import { stripMarkdownForSpeech } from './utils/strip-markdown.util';

@ApiTags('Widget')
@Controller('api/v1/widget')
export class WidgetController {
  constructor(
    private readonly sessions: ChatSessionService,
    private readonly mistral: MistralChatService,
  ) {}

  @Get('config')
  @UseGuards(WidgetApiKeyGuard)
  @ApiBearerAuth('widget-api-key')
  @ApiOperation({
    summary: 'Get widget configuration',
    description: 'Returns bot name, welcome message, theme, and TTS settings for the embed.',
  })
  @ApiResponse({ status: 200, type: WidgetConfigResponseDto })
  getConfig(@Req() req: { widgetAuth: ApiKeyValidation }) {
    const { config } = req.widgetAuth;
    return {
      name: config.name,
      welcomeMessage: config.welcomeMessage,
      theme: config.widgetTheme ?? {},
      isActive: config.isActive,
      ttsEnabled: config.widgetTtsEnabled ?? false,
    };
  }

  @Post('sessions')
  @UseGuards(WidgetApiKeyGuard)
  @ApiBearerAuth('widget-api-key')
  @ApiOperation({
    summary: 'Create a chat session',
    description:
      'Starts a new widget conversation. Store sessionId and visitorId; send X-Visitor-Id on later messages.',
  })
  @ApiResponse({ status: 201, type: CreateWidgetSessionResponseDto })
  createSession(
    @Req() req: { widgetAuth: ApiKeyValidation },
    @Body() dto: CreateWidgetSessionDto,
  ) {
    const { config, key } = req.widgetAuth;
    const visitorId = dto.visitorId ?? randomBytes(16).toString('hex');
    return this.sessions
      .createSession({
        tenantId: key.tenantId,
        config,
        channel: 'widget',
        visitorId,
        metadata: dto.metadata,
      })
      .then((session) => ({
        sessionId: session.id,
        visitorId,
        welcomeMessageId: (session as { welcomeMessageId?: string }).welcomeMessageId,
      }));
  }

  @Post('sessions/:id/messages')
  @UseGuards(WidgetApiKeyGuard)
  @ApiBearerAuth('widget-api-key')
  @ApiOperation({ summary: 'Send a user message', description: 'Returns the assistant reply with optional RAG citations.' })
  @ApiHeader({
    name: 'X-Visitor-Id',
    required: false,
    description: 'Visitor ID from session creation. Required when the session has a visitorId.',
  })
  @ApiResponse({ status: 201, type: AssistantMessageResponseDto })
  async sendMessage(
    @Req() req: { widgetAuth: ApiKeyValidation },
    @Param('id') sessionId: string,
    @Body() dto: SendMessageDto,
    @Headers('x-visitor-id') visitorId?: string,
  ) {
    const { config, key } = req.widgetAuth;
    const session = await this.sessions.getSession(key.tenantId, sessionId);

    if (session.channel === 'widget' && visitorId && session.visitorId !== visitorId) {
      throw new ForbiddenException('Session visitor mismatch');
    }

    const widgetUserId = `widget:${visitorId ?? session.visitorId ?? 'anonymous'}`;
    const { assistantMessage } = await this.sessions.sendMessage({
      tenantId: key.tenantId,
      sessionId,
      userId: widgetUserId,
      content: dto.content,
      config,
    });

    return {
      messageId: assistantMessage.id,
      role: assistantMessage.role,
      content: assistantMessage.content,
      citations: assistantMessage.citations ?? [],
    };
  }

  @Post('sessions/:sessionId/messages/:messageId/speech')
  @UseGuards(WidgetApiKeyGuard)
  @ApiBearerAuth('widget-api-key')
  @ApiOperation({ summary: 'Text-to-speech for an assistant message' })
  @ApiHeader({ name: 'X-Visitor-Id', required: false })
  @ApiProduces('audio/mpeg')
  @ApiResponse({ status: 200, description: 'MPEG audio stream' })
  async speakMessage(
    @Req() req: { widgetAuth: ApiKeyValidation },
    @Param('sessionId') sessionId: string,
    @Param('messageId') messageId: string,
    @Headers('x-visitor-id') visitorId: string | undefined,
    @Res() res: Response,
  ) {
    const { config, key } = req.widgetAuth;
    if (!config.widgetTtsEnabled) {
      throw new BadRequestException('Text-to-speech is not enabled for this chatbot');
    }

    const session = await this.sessions.getSession(key.tenantId, sessionId);
    if (session.channel === 'widget' && visitorId && session.visitorId !== visitorId) {
      throw new ForbiddenException('Session visitor mismatch');
    }

    const message = await this.sessions.getAssistantMessage(
      key.tenantId,
      sessionId,
      messageId,
    );
    const plainText = stripMarkdownForSpeech(message.content);
    const { audioData } = await this.mistral.speak(plainText, {
      voiceId: config.mistralVoiceId,
    });

    const buffer = Buffer.from(audioData, 'base64');
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  }
}
