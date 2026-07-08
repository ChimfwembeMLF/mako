import { IsString, IsOptional, IsUUID } from 'class-validator';

export class LeadSourcesUpdateDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  webhookSecret?: string;
}
