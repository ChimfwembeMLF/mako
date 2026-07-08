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

export class ProfilesUpdateDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsBoolean()
  isSystemAdmin?: boolean;

  @IsOptional()
  @IsDate()
  createdAt?: Date;

  @IsOptional()
  @IsDate()
  updatedAt?: Date;
}
