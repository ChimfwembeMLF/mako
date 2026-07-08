import { IsString, IsOptional, IsUUID } from 'class-validator';

export class LeadSourcesCreateDto {
  @IsUUID()
  tenantId: string;

  @IsUUID()
  userId: string;

  @IsString()
  label: string;

  @IsOptional()
  @IsString()
  webhookSecret?: string;
}
