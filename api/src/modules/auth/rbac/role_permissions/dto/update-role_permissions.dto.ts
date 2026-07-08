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

export class RolePermissionsUpdateDto {
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @IsOptional()
  @IsString()
  permissionKey?: string;
}
