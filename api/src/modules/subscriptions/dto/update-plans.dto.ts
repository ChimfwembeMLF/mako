import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class PlanPatchDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceZmw?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  aiCallsLimit?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  seatLimit?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tenantLimit?: number | null;

  @IsOptional()
  @IsBoolean()
  dailyWorkflowEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  highlight?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];
}

export class UpdatePlansDto {
  @ValidateNested()
  @Type(() => PlanPatchDto)
  free?: PlanPatchDto;

  @ValidateNested()
  @Type(() => PlanPatchDto)
  starter?: PlanPatchDto;

  @ValidateNested()
  @Type(() => PlanPatchDto)
  pro?: PlanPatchDto;
}
