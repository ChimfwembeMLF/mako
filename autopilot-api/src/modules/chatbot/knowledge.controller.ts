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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { KnowledgeDocumentService } from './services/knowledge-document.service';
import { ChatbotAccessService } from './services/chatbot-access.service';
import { UpdateKnowledgeDocumentDto } from './dto/update-knowledge-document.dto';

interface JwtUser {
  sub: string;
}

@ApiTags('Knowledge')
@Controller('api/v1/knowledge')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class KnowledgeController {
  constructor(
    private readonly documents: KnowledgeDocumentService,
    private readonly access: ChatbotAccessService,
  ) {}

  @Get('documents')
  async list(
    @Req() req: { user: JwtUser },
    @Query('tenantId') tenantId: string,
  ) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    await this.access.assertPermission(String(req.user.sub), tenantId, 'chatbot.view');
    return this.documents.list(tenantId);
  }

  @Post('documents')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Req() req: { user: JwtUser },
    @UploadedFile() file: Express.Multer.File,
    @Query('tenantId') tenantId: string,
  ) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    await this.access.assertPermission(String(req.user.sub), tenantId, 'chatbot.manage');
    return this.documents.upload({
      tenantId,
      userId: String(req.user.sub),
      file,
    });
  }

  @Patch('documents/:id')
  async rename(
    @Req() req: { user: JwtUser },
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgeDocumentDto,
  ) {
    if (!dto.tenantId) throw new BadRequestException('tenantId is required');
    await this.access.assertPermission(String(req.user.sub), dto.tenantId, 'chatbot.manage');
    return this.documents.rename(dto.tenantId, id, dto.title);
  }

  @Delete('documents/:id')
  async remove(
    @Req() req: { user: JwtUser },
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
  ) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    await this.access.assertPermission(String(req.user.sub), tenantId, 'chatbot.manage');
    await this.documents.delete(tenantId, id);
    return { success: true };
  }

  @Post('documents/sync-mistral')
  async syncMistral(
    @Req() req: { user: JwtUser },
    @Query('tenantId') tenantId: string,
  ) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    await this.access.assertPermission(String(req.user.sub), tenantId, 'chatbot.manage');
    return this.documents.syncMistral(tenantId);
  }

  @Post('documents/:id/reindex')
  async reindex(
    @Req() req: { user: JwtUser },
    @Param('id') id: string,
    @Query('tenantId') tenantId: string,
  ) {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    await this.access.assertPermission(String(req.user.sub), tenantId, 'chatbot.manage');
    return this.documents.reindex(tenantId, id, String(req.user.sub));
  }
}
