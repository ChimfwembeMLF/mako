import {
  IsString,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsDate,
  IsArray,
  IsNumber,
  IsInt,
} from 'class-validator';

export class LeadsCreateDto {
  @IsUUID()
  tenantId: string;

  @IsOptional()
  @IsUUID()
  workspaceId?: string;

  @IsUUID()
  userId: string;

  @IsString()
  name: string;

  @IsString()
  email: string;

  @IsString()
  source: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  classification?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  aiReply?: string;

  @IsOptional()
  @IsBoolean()
  unsubscribed?: boolean;

  @IsOptional()
  @IsString()
  unsubscribeToken?: string;

  @IsOptional()
  @IsDate()
  deletedAt?: Date;

  @IsDate()
  createdAt: Date;

  @IsDate()
  updatedAt: Date;
}
