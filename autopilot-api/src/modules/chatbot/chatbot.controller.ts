import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { MistralChatService } from '../ai/services/mistral-chat.service';
import { MistralTtsService } from '../ai/services/mistral-tts.service';
import { ChatbotTtsVoiceService } from './services/chatbot-tts-voice.service';
import { stripMarkdownForSpeech } from './utils/strip-markdown.util';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatbotConfigService } from './services/chatbot-config.service';
import { ChatSessionService } from './services/chat-session.service';
import { ChatApiKeyService } from './services/chat-api-key.service';
import { ChatbotAccessService } from './services/chatbot-access.service';
import { UpdateChatbotConfigDto } from './dto/update-chatbot-config.dto';
import { CreateApiKeyDto, CreateSessionDto, SendMessageDto } from './dto/send-message.dto';
import { EscalateSessionDto } from './dto/escalate-session.dto';

interface JwtUser {
  sub: string;
}

@ApiTags('Chatbot')
@Controller('api/v1/chatbot')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatbotController {
  constructor(
    private readonly configService: ChatbotConfigService,
    private readonly sessions: ChatSessionService,
    private readonly apiKeys: ChatApiKeyService,
    private readonly access: ChatbotAccessService,
    private readonly mistral: MistralChatService,
    private readonly mistralTts: MistralTtsService,
    private readonly ttsVoices: ChatbotTtsVoiceService,
  ) {}

  @Get('config')
  async getConfig(
    @Req() req: { user: JwtUser },
    @Query('tenantId') tenantId: string,
  ) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    await this.access.assertPermission(String(req.user.sub), tenantId, 'chatbot.view');
    const config = await this.configService.getOrCreate(tenantId);
    const keys = await this.apiKeys.listKeys(tenantId);
    return {
      config,
      keys: keys.map((k) => ({
        id: k.id,
        keyPrefix: k.keyPrefix,
        label: k.label,
        lastUsedAt: k.lastUsedAt,
        revokedAt: k.revokedAt,
        created_at: k.created_at,
      })),
    };
  }

  @Post('config/avatar')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @Req() req: { user: JwtUser },
    @UploadedFile() file: Express.Multer.File,
    @Query('tenantId') tenantId: string,
  ) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    await this.access.assertPermission(String(req.user.sub), tenantId, 'chatbot.manage');
    return this.configService.uploadAvatar(tenantId, file);
  }

  @Post('config/avatar-model')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatarModel(
    @Req() req: { user: JwtUser },
    @UploadedFile() file: Express.Multer.File,
    @Query('tenantId') tenantId: string,
  ) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    await this.access.assertPermission(String(req.user.sub), tenantId, 'chatbot.manage');
    return this.configService.uploadAvatarModel(tenantId, file);
  }

  @Patch('config')
  async updateConfig(
    @Req() req: { user: JwtUser },
    @Body() dto: UpdateChatbotConfigDto,
  ) {
    if (!dto.tenantId) throw new BadRequestException('tenantId is required');
    await this.access.assertPermission(String(req.user.sub), dto.tenantId, 'chatbot.manage');
    const { tenantId, ...patch } = dto;
    return this.configService.update(tenantId, patch);
  }

  @Post('config/keys')
  async createKey(
    @Req() req: { user: JwtUser },
    @Body() dto: CreateApiKeyDto,
  ) {
    if (!dto.tenantId) throw new BadRequestException('tenantId is required');
    await this.access.assertPermission(String(req.user.sub), dto.tenantId, 'chatbot.manage');
    const config = await this.configService.getOrCreate(dto.tenantId);
    return this.apiKeys.createKey({
      tenantId: dto.tenantId,
      configId: config.id,
      label: dto.label,
    });
  }

  @Delete('config/keys/:id')
  async revokeKey(
    @Req() req: { user: JwtUser },
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
  ) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    await this.access.assertPermission(String(req.user.sub), tenantId, 'chatbot.manage');
    await this.apiKeys.revokeKey(tenantId, id);
    return { success: true };
  }

  @Get('sessions')
  async listSessions(
    @Req() req: { user: JwtUser },
    @Query('tenantId') tenantId: string,
    @Query('channel') channel?: 'admin' | 'widget' | 'api',
  ) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    await this.access.assertPermission(String(req.user.sub), tenantId, 'chatbot.view');
    return this.sessions.listSessions(tenantId, channel);
  }

  @Post('sessions')
  async createSession(
    @Req() req: { user: JwtUser },
    @Body() dto: CreateSessionDto,
  ) {
    if (!dto.tenantId) throw new BadRequestException('tenantId is required');
    await this.access.assertPermission(String(req.user.sub), dto.tenantId, 'chatbot.use');
    const config = await this.configService.getOrCreate(dto.tenantId);
    return this.sessions.createSession({
      tenantId: dto.tenantId,
      config,
      channel: 'admin',
      userId: String(req.user.sub),
      title: dto.title,
      metadata: dto.metadata,
    });
  }

  @Get('sessions/:id/messages')
  async getMessages(
    @Req() req: { user: JwtUser },
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
  ) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    await this.access.assertPermission(String(req.user.sub), tenantId, 'chatbot.view');
    return this.sessions.getMessages(tenantId, id);
  }

  @Post('sessions/:id/escalate')
  async escalateSession(
    @Req() req: { user: JwtUser },
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
    @Body() dto: EscalateSessionDto,
  ) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    await this.access.assertPermission(String(req.user.sub), tenantId, 'chatbot.manage');
    return this.sessions.escalateSession({
      tenantId,
      sessionId: id,
      userMessage: dto.userMessage,
      visitorEmail: dto.visitorEmail,
    });
  }

  @Post('sessions/:id/messages')
  async sendMessage(
    @Req() req: { user: JwtUser },
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
    @Body() dto: SendMessageDto,
  ) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    await this.access.assertPermission(String(req.user.sub), tenantId, 'chatbot.use');
    const { userMessage, assistantMessage } = await this.sessions.sendMessage({
      tenantId,
      sessionId: id,
      userId: String(req.user.sub),
      content: dto.content,
    });
    return {
      userMessageId: userMessage.id,
      messageId: assistantMessage.id,
      role: assistantMessage.role,
      content: assistantMessage.content,
      citations: assistantMessage.citations ?? [],
    };
  }

  @Get('tts/voices')
  async listTtsVoices(
    @Req() req: { user: JwtUser },
    @Query('tenantId') tenantId: string,
  ) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    await this.access.assertPermission(String(req.user.sub), tenantId, 'chatbot.view');
    return this.ttsVoices.listForTenant(tenantId);
  }

  @Post('tts/voices')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async cloneTtsVoice(
    @Req() req: { user: JwtUser },
    @UploadedFile() file: Express.Multer.File,
    @Query('tenantId') tenantId: string,
    @Body('name') name: string,
  ) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    await this.access.assertPermission(String(req.user.sub), tenantId, 'chatbot.manage');
    if (!file?.buffer?.length) throw new BadRequestException('file is required');
    if (!name?.trim()) throw new BadRequestException('name is required');
    return this.ttsVoices.cloneVoice(tenantId, String(req.user.sub), {
      name: name.trim(),
      sampleBuffer: file.buffer,
      sampleFilename: file.originalname || 'voice-sample.webm',
    });
  }

  @Delete('tts/voices/:id')
  async deleteTtsVoice(
    @Req() req: { user: JwtUser },
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
  ) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    await this.access.assertPermission(String(req.user.sub), tenantId, 'chatbot.manage');
    return this.ttsVoices.deleteCustomVoice(tenantId, id);
  }

  @Post('tts/preview')
  async previewTtsVoice(
    @Req() req: { user: JwtUser },
    @Query('tenantId') tenantId: string,
    @Body() body: { voiceId: string; text?: string },
    @Res() res: Response,
  ) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    if (!body?.voiceId?.trim()) throw new BadRequestException('voiceId is required');
    await this.access.assertPermission(String(req.user.sub), tenantId, 'chatbot.view');
    const text =
      body.text?.trim() ||
      'Hello! This is a preview of how your chatbot agent will sound.';
    const { audioData } = await this.mistralTts.speak(text, body.voiceId.trim());
    const buffer = Buffer.from(audioData, 'base64');
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
  }

  @Post('sessions/:sessionId/messages/:messageId/speech')
  async speakMessage(
    @Req() req: { user: JwtUser },
    @Param('sessionId') sessionId: string,
    @Param('messageId') messageId: string,
    @Query('tenantId') tenantId: string,
    @Res() res: Response,
  ) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    await this.access.assertPermission(String(req.user.sub), tenantId, 'chatbot.use');
    const config = await this.configService.getOrCreate(tenantId);
    if (!config.widgetTtsEnabled) {
      throw new BadRequestException('Text-to-speech is not enabled for this chatbot');
    }

    const message = await this.sessions.getAssistantMessage(tenantId, sessionId, messageId);
    const plainText = stripMarkdownForSpeech(message.content);
    const { audioData } = await this.mistral.speak(plainText, {
      voiceId: config.mistralVoiceId,
    });

    const buffer = Buffer.from(audioData, 'base64');
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  }

  @Delete('sessions/:id')
  async deleteSession(
    @Req() req: { user: JwtUser },
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
  ) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    await this.access.assertPermission(String(req.user.sub), tenantId, 'chatbot.manage');
    await this.sessions.deleteSession(tenantId, id);
    return { success: true };
  }
}
