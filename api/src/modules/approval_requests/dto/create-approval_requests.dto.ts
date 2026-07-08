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

export class ApprovalRequestsCreateDto {
  @IsUUID()
  tenantId: string;

  @IsString()
  actionKey: string;

  @IsString()
  resourceType: string;

  @IsUUID()
  resourceId: string;

  @IsOptional()
  payload?: string;

  @IsUUID()
  requestedBy: string;

  @IsOptional()
  @IsUUID()
  reviewedBy?: string;

  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  requesterNotes?: string;

  @IsOptional()
  @IsString()
  reviewerNotes?: string;

  @IsDate()
  createdAt: Date;

  @IsOptional()
  @IsDate()
  reviewedAt?: Date;
}
