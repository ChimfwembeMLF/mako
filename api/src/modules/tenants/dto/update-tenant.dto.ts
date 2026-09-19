import { IsString, IsOptional, IsEnum } from 'class-validator';
import { IntegrationProvider } from '../entities/tenant-integration-config.entity';

export class UpdateTenantDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  subdomain?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(IntegrationProvider)
  @IsOptional()
  preferredAiProvider?: IntegrationProvider;
}
