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

export class LeadsUpdateDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  source?: string;

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

  @IsOptional()
  @IsDate()
  createdAt?: Date;

  @IsOptional()
  @IsDate()
  updatedAt?: Date;
}
