import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IntegrationProvider } from '../entities/tenant-integration-config.entity';
import { ApiProperty } from '@nestjs/swagger';

/** Google Drive stores OAuth tokens here through its own flow, and Parler has no key. */
export const API_KEY_PROVIDERS = [
  IntegrationProvider.MISTRAL,
  IntegrationProvider.OPENAI,
  IntegrationProvider.GEMINI,
  IntegrationProvider.DEEPSEEK,
];

export class UpsertIntegrationConfigDto {
  @ApiProperty({ enum: API_KEY_PROVIDERS })
  @IsIn(API_KEY_PROVIDERS)
  @IsNotEmpty()
  provider: IntegrationProvider;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  apiKey: string;
}
