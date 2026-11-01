import {
  MAX_CAMPAIGN_POSTS,
  MIN_CAMPAIGN_POSTS,
} from '../services/generate-campaign.service';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class GenerateCampaignDto {
  @IsUUID()
  tenantId: string;

  @IsUUID()
  workspaceId: string;

  @IsString()
  theme: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  goal?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  platforms?: string[];

  @IsOptional()
  @IsInt()
  @Min(MIN_CAMPAIGN_POSTS)
  @Max(MAX_CAMPAIGN_POSTS)
  postCount?: number;

  /** ISO date YYYY-MM-DD */
  @IsOptional()
  @IsString()
  startDate?: string;
}
