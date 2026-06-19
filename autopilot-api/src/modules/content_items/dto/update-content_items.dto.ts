import {
  IsString,
  IsOptional,
  IsUUID,
  IsDate,
  IsArray,
  IsObject,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  toOptionalDate,
  toOptionalTimeString,
} from '../../../common/dto/date-transform.util';

export class ContentItemsUpdateDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsUUID()
  workspaceId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  brandProfileId?: string;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  campaignTheme?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  platforms?: string[];

  @IsOptional()
  @IsObject()
  platformPayloads?: Record<string, unknown>;

  @IsOptional()
  @Transform(({ value }) => toOptionalDate(value))
  @IsDate()
  scheduledDate?: Date;

  @IsOptional()
  @Transform(({ value }) => toOptionalTimeString(value))
  @IsString()
  scheduledTime?: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalDate(value))
  @IsDate()
  publishedAt?: Date;

  @IsOptional()
  @IsString()
  externalPostId?: string;

  @IsOptional()
  @IsString()
  publishFailedReason?: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalDate(value))
  @IsDate()
  deletedAt?: Date;
}
