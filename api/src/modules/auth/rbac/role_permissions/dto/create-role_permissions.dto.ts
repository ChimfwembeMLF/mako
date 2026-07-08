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

export class RolePermissionsCreateDto {
  @IsUUID()
  roleId: string;

  @IsString()
  permissionKey: string;
}
