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

export class TenantMembersCreateDto {
  @IsUUID()
  tenantId: string;

  @IsUUID()
  userId: string;

  @IsUUID()
  roleId: string;

  @IsBoolean()
  isActive: boolean;

  @IsUUID()
  invitedBy: string;

  @IsDate()
  joinedAt: Date;
}
