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
  @Min(3)
  @Max(14)
  postCount?: number;

  /** ISO date YYYY-MM-DD */
  @IsOptional()
  @IsString()
  startDate?: string;
}
