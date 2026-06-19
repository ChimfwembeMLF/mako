import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SendMessageDto {
  @ApiProperty({
    example: 'What are your business hours?',
    minLength: 1,
    maxLength: 8000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  content: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateSessionDto {
  @IsUUID()
  tenantId: string;

  @IsOptional()
  @IsUUID()
  workspaceId?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateWidgetSessionDto {
  @ApiPropertyOptional({
    description: 'Stable visitor identifier. Generated server-side if omitted.',
    example: 'visitor-abc123',
  })
  @IsOptional()
  @IsString()
  visitorId?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateApiKeyDto {
  @IsUUID()
  tenantId: string;

  @IsOptional()
  @IsString()
  label?: string;
}
