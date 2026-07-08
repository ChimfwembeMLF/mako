import { IsString, IsOptional, IsIn, IsArray } from 'class-validator';
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

export class UpdateWhatsappTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

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
