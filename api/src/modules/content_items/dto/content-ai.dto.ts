import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  IsArray,
  IsObject,
} from 'class-validator';

export class GenerateContentDto {
  @IsOptional()
  @IsString()
  theme?: string;

  @IsOptional()
  @IsString()
  draft?: string;

  @IsOptional()
  @IsUUID()
  workspaceId?: string;

  @IsOptional()
  @IsString()
  workspace_id?: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsOptional()
  @IsBoolean()
  save?: boolean;
}

export class RepurposeContentDto {
  @IsUUID()
  contentId: string;
}

export class AdaptPlatformsDto {
  @IsUUID()
  tenantId: string;

  @IsOptional()
  @IsUUID()
  workspaceId?: string;

  @IsOptional()
  @IsString()
  workspace_id?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsString()
  content: string;

  @IsArray()
  @IsString({ each: true })
  platforms: string[];
}

export class GenerateImageDto {
  @IsString()
  prompt: string;

  @IsUUID()
  tenantId: string;

  @IsOptional()
  @IsUUID()
  contentId?: string;

  @IsOptional()
  @IsString()
  contentType?: string;
}

export class GenerateSlideshowDto {
  @IsString()
  theme: string;

  @IsUUID()
  tenantId: string;

  @IsOptional()
  slideCount?: number;

  @IsOptional()
  @IsUUID()
  contentId?: string;
}

export class PublishContentDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  platforms?: string[];

  /** Per-platform copy + media; persisted and used for publish */
  @IsOptional()
  @IsObject()
  platformPayloads?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  contentType?: string;
}

export class DailyWorkflowDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsUUID()
  workspaceId?: string;
}
