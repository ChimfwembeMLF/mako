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

export class PaymentFailuresUpdateDto {
  @IsOptional()
  @IsString()
  depositId?: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  rawPayload?: string;

  @IsOptional()
  @IsDate()
  createdAt?: Date;
}
