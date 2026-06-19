import {
  IsString,
  IsOptional,
  IsUUID,
  IsDate,
  IsArray,
  IsObject,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { toOptionalDate, toOptionalTimeString } from '../../../common/dto/date-transform.util';

export class ContentItemsCreateDto {
  @IsUUID()
  tenantId: string;

  @IsUUID()
  workspaceId: string;

  /** Set server-side from JWT; optional in request body. */
  @IsOptional()
  @IsUUID()
  @Transform(({ value }) => (value === '' ? undefined : value))
  userId?: string;

  /** Resolved server-side from tenant + user brand profile when omitted. */
  @IsOptional()
  @IsUUID()
  @Transform(({ value }) => (value === '' ? undefined : value))
  brandProfileId?: string;

  @IsString()
  contentType: string;

  @IsString()
  title: string;

  @IsString()
  content: string;

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
