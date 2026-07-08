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

export class UserPermissionsUpdateDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  permissionKey?: string;

  @IsOptional()
  @IsString()
  effect?: string;

  @IsOptional()
  @IsDate()
  validFrom?: Date;

  @IsOptional()
  @IsDate()
  validUntil?: Date;

  @IsOptional()
  @IsUUID()
  grantedBy?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsDate()
  createdAt?: Date;
}
