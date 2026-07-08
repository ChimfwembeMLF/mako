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

export class UserPermissionsCreateDto {
  @IsUUID()
  tenantId: string;

  @IsUUID()
  userId: string;

  @IsString()
  permissionKey: string;

  @IsString()
  effect: string;

  @IsOptional()
  @IsDate()
  validFrom?: Date;

  @IsOptional()
  @IsDate()
  validUntil?: Date;

  @IsUUID()
  grantedBy: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsDate()
  createdAt: Date;
}
