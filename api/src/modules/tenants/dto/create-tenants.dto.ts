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

export class TenantsCreateDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsUUID()
  ownerId: string;

  @IsDate()
  createdAt: Date;

  @IsDate()
  updatedAt: Date;
}
