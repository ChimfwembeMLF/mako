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

export class AiUsageCreateDto {
  @IsUUID()
  tenantId: string;

  @IsUUID()
  userId: string;

  @IsString()
  functionName: string;

  tokensUsed: string;

  @IsOptional()
  @IsDate()
  createdAt?: Date;
}
