import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MistralChatService } from './services/mistral-chat.service';
import { FormSuggestionsService } from './services/form-suggestions.service';
import { FormSuggestionsDto } from './dto/form-suggestions.dto';
import { EnhanceFieldDto } from './dto/enhance-field.dto';

interface JwtUser {
  sub: string;
}

@ApiTags('AI')
@Controller('api/v1/ai')
export class AiController {
  constructor(
    private readonly mistral: MistralChatService,
    private readonly formSuggestions: FormSuggestionsService,
  ) {}

  @Get('health')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async health() {
    const result = await this.mistral.healthCheck();
    return { status: result.ok ? 'ok' : 'degraded', model: result.model };
  }

  @Post('form-suggestions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  suggestions(@Req() req: { user: JwtUser }, @Body() dto: FormSuggestionsDto) {
    return this.formSuggestions.getSuggestions({
      tenantId: dto.tenantId,
      workspaceId: dto.workspaceId,
      userId: String(req.user.sub),
      form: dto.form,
      fields: dto.fields,
    });
  }

  @Post('enhance-field')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  enhanceField(@Req() req: { user: JwtUser }, @Body() dto: EnhanceFieldDto) {
    return this.formSuggestions.enhanceField({
      tenantId: dto.tenantId,
      workspaceId: dto.workspaceId,
      userId: String(req.user.sub),
      form: dto.form,
      fieldKey: dto.fieldKey,
      currentValue: dto.currentValue,
    });
  }
}
