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

export class ApprovalWorkflowsCreateDto {
  @IsString()
  label: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsBoolean()
  isEnabled: boolean;

  @IsUUID()
  approverRoleId: string;

  @IsUUID()
  updatedBy: string;

  @IsDate()
  updatedAt: Date;
}
