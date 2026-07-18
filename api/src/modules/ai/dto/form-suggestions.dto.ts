import { IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { FormSuggestionType } from '../form-suggestion-forms.constants';

export class FormSuggestionsDto {
  @IsUUID()
  tenantId: string;

  @IsOptional()
  @IsUUID()
  workspaceId?: string;

  @IsIn(['brand-brain', 'content', 'campaign', 'whatsapp-menu'])
  form: FormSuggestionType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fields?: string[];

  /** Client nonce so each request gets fresh suggestions */
  @IsOptional()
  @IsString()
  variationSeed?: string;

  @IsOptional()
  @IsBoolean()
  refresh?: boolean;

  /** Prior suggestion texts to avoid repeating on refresh */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  avoidTexts?: string[];
}
