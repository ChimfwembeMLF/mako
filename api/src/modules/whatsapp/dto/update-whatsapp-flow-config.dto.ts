import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
  ArrayMaxSize,
  ValidateIf,
} from 'class-validator';

export class WhatsappMenuItemDto {
  @ApiPropertyOptional({ example: 'pricing' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  id?: string;

  @ApiProperty({ example: 'Pricing & plans' })
  @IsString()
  @MaxLength(24)
  title: string;

  @ApiPropertyOptional({ example: 'See our packages' })
  @IsOptional()
  @IsString()
  @MaxLength(72)
  description?: string;

  @ValidateIf((o) => !o.aiGenerate)
  @IsString()
  @MaxLength(4096)
  response?: string;

  @ApiPropertyOptional({
    description:
      'When true, AI writes the reply using title + response as guidance',
  })
  @IsOptional()
  @IsBoolean()
  aiGenerate?: boolean;
}

export class UpdateWhatsappFlowConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    example: 'Acme Shop',
    description: 'Your business name — shown in the WhatsApp welcome line',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  serviceName?: string;

  @ApiPropertyOptional({
    example: 'Welcome to {serviceName}! How can we help?',
    description:
      'Optional custom welcome text. Use {serviceName} as a placeholder.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  welcomeMessage?: string;

  @ApiPropertyOptional({ example: ['hi', 'hello', 'menu'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  welcomeTriggers?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  aiFallbackEnabled?: boolean;

  @ApiPropertyOptional({ type: [WhatsappMenuItemDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => WhatsappMenuItemDto)
  menuItems?: WhatsappMenuItemDto[];
}
