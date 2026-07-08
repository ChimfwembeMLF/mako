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

export class AutoReplyRulesUpdateDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  triggerKeywords?: string[];

  @IsOptional()
  @IsString()
  triggerSentiment?: string;

  @IsOptional()
  @IsString()
  responseTemplate?: string;

  @IsOptional()
  @IsBoolean()
  aiGenerate?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

}
