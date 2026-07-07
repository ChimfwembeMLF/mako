import {
  IsString,
  IsOptional,
  IsIn,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  TemplateCategory,
  TemplateComponent,
  TemplateVariable,
} from '../entities/whatsapp_template.entity';

const CATEGORIES: TemplateCategory[] = [
  'MARKETING',
  'UTILITY',
  'AUTHENTICATION',
];

export class CreateWhatsappTemplateDto {
  @IsString()
  tenantId: string;

  @IsOptional()
  @IsString()
  workspaceId?: string;

  /** Must be snake_case, letters/numbers/underscores only */
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsIn(CATEGORIES)
  category?: TemplateCategory;

  @IsOptional()
  @IsArray()
  components?: TemplateComponent[];

  @IsOptional()
  @IsArray()
  variables?: TemplateVariable[];
}
