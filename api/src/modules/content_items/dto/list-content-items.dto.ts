import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

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

  @IsOptional()
  includeMedia?: string;
}

export type PaginatedContentItems = {
  items: unknown[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
