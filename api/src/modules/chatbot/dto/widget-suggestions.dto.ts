import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class WidgetSuggestionsDto {
  @ApiPropertyOptional({
    description: 'Last assistant message to derive follow-up prompts from',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  lastAssistantMessage?: string;
}

export class WidgetSuggestionsResponseDto {
  suggestions: string[];
}
