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

export class PaymentFailuresCreateDto {
  @IsString()
  depositId: string;

  @IsUUID()
  tenantId: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  rawPayload?: string;

  @IsDate()
  createdAt: Date;
}
