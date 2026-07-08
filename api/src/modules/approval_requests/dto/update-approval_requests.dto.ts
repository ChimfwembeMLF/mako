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

export class ApprovalRequestsUpdateDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsString()
  actionKey?: string;

  @IsOptional()
  @IsString()
  resourceType?: string;

  @IsOptional()
  @IsUUID()
  resourceId?: string;

  @IsOptional()
  payload?: string;

  @IsOptional()
  @IsUUID()
  requestedBy?: string;

  @IsOptional()
  @IsUUID()
  reviewedBy?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  requesterNotes?: string;

  @IsOptional()
  @IsString()
  reviewerNotes?: string;

  @IsOptional()
  @IsDate()
  createdAt?: Date;

  @IsOptional()
  @IsDate()
  reviewedAt?: Date;
}
