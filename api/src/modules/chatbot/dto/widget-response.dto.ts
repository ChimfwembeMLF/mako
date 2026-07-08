import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WidgetConfigResponseDto {
  @ApiProperty({ example: 'Website Assistant' })
  name: string;

  @ApiPropertyOptional({ example: 'Hi! How can I help you today?' })
  welcomeMessage?: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  theme: Record<string, unknown>;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  ttsEnabled: boolean;

  @ApiProperty({ type: [String], example: ['What can you help me with?'] })
  suggestions: string[];
}

export class CreateWidgetSessionResponseDto {
  @ApiProperty({ format: 'uuid' })
  sessionId: string;

  @ApiProperty()
  visitorId: string;

  @ApiPropertyOptional({ format: 'uuid' })
  welcomeMessageId?: string;
}

export class ChatCitationDto {
  @ApiPropertyOptional()
  documentId?: string;

  @ApiPropertyOptional()
  title?: string;

  @ApiPropertyOptional()
  excerpt?: string;
}

export class AssistantMessageResponseDto {
  @ApiProperty({ format: 'uuid' })
  messageId: string;

  @ApiProperty({ enum: ['assistant'] })
  role: 'assistant';

  @ApiProperty()
  content: string;

  @ApiProperty({ type: [ChatCitationDto] })
  citations: ChatCitationDto[];
}
