import { IsString, IsOptional, IsObject } from 'class-validator';

export class SystemSettingsUpsertDto {
  @IsObject()
  value: Record<string, unknown>;

  @IsOptional()
  @IsString()
  description?: string;
}
