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

export class DepositsUpdateDto {
  @IsOptional()
  @IsString()
  depositId?: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsString()
  plan?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  amount?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  correspondent?: string;

  @IsOptional()
  @IsString()
  msisdn?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  rawPayload?: string;

  @IsOptional()
  @IsDate()
  createdAt?: Date;

  @IsOptional()
  @IsDate()
  updatedAt?: Date;
}
