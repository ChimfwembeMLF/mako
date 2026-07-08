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

export class WhatsappContactsCreateDto {
  @IsUUID()
  tenantId: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsBoolean()
  optedIn: boolean;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  optedInAt?: Date;

  @IsOptional()
  @IsUUID()
  workspaceId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
