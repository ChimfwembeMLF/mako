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
import { Type } from 'class-transformer';

export class WhatsappContactsUpdateDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  optedIn?: boolean;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  optedInAt?: Date;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsUUID()
  workspaceId?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  createdAt?: Date;
}
