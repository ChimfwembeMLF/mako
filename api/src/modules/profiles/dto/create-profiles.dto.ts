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

export class ProfilesCreateDto {
  @IsUUID()
  userId: string;

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

  @IsDate()
  createdAt: Date;

  @IsDate()
  updatedAt: Date;
}
