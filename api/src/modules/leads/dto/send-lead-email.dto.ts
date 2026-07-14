import { IsOptional, IsString, IsUUID } from 'class-validator';

export class SendLeadEmailDto {
  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsUUID()
  leadId?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  htmlBody?: string;

  @IsOptional()
  @IsString()
  message?: string;
}
