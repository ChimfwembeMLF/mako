import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class UpdateChatbotConfigDto {
  @IsUUID()
  tenantId: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  welcomeMessage?: string;

  @IsOptional()
  @IsString()
  systemPromptExtra?: string;

  @IsOptional()
  @IsUUID()
  brandProfileId?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(50)
  maxContextMessages?: number;

  @IsOptional()
  @IsBoolean()
  ragEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  ragTopK?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  ragMinScore?: number;

  @IsOptional()
  @IsBoolean()
  widgetEnabled?: boolean;

  @IsOptional()
  widgetTheme?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedOrigins?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  useMistralLibrary?: boolean;

  @IsOptional()
  @IsBoolean()
  widgetTtsEnabled?: boolean;

  @IsOptional()
  @IsString()
  mistralVoiceId?: string;
}
