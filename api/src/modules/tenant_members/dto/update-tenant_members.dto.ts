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

export class TenantMembersUpdateDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  roleId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsUUID()
  invitedBy?: string;

  @IsOptional()
  @IsDate()
  joinedAt?: Date;
}
