import {
  IsString,
  IsOptional,
  IsUUID,
  IsDate,
  IsObject,
  IsEnum,
} from 'class-validator';
import { IntegrationProvider } from '../entities/tenant-integration-config.entity';

export class TenantsUpdateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsObject()
  themeConfig?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(IntegrationProvider)
  preferredAiProvider?: IntegrationProvider;

  @IsOptional()
  @IsDate()
  createdAt?: Date;

  @IsOptional()
  @IsDate()
  updatedAt?: Date;
}
