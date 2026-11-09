import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

/** The Posts page's tabs, each covering one or more stored statuses. */
export const CONTENT_STATUS_GROUPS = [
  'drafts',
  'scheduled',
  'published',
  'failed',
] as const;
export type ContentStatusGroup = (typeof CONTENT_STATUS_GROUPS)[number];
export const STATUSES_BY_GROUP: Record<ContentStatusGroup, string[]> = {
  drafts: ['draft', 'pending', 'rejected'],
  scheduled: ['scheduled', 'approved'],
  published: ['published', 'partial'],
  failed: ['publish_failed', 'failed'],
};

export class ListContentItemsQueryDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsUUID()
  workspaceId?: string;

  /** One of the Posts page's tabs. */
  @IsOptional()
  @IsIn(CONTENT_STATUS_GROUPS)
  status?: ContentStatusGroup;

  @IsOptional()
  includeMedia?: string;
}

export type PaginatedContentItems = {
  items: unknown[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  /** How many posts fall in each tab, for the current search and platform. */
  statusCounts?: Record<ContentStatusGroup | 'all', number>;
};
