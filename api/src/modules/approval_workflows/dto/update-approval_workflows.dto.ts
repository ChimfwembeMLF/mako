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

export class ApprovalWorkflowsUpdateDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsUUID()
  approverRoleId?: string;

  @IsOptional()
  @IsUUID()
  updatedBy?: string;

  @IsOptional()
  @IsDate()
  updatedAt?: Date;
}
