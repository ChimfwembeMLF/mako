import { IsArray, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { FormSuggestionType } from '../form-suggestion-forms.constants';

export class EnhanceFieldDto {
  @IsUUID()
  tenantId: string;

  @IsOptional()
  @IsUUID()
  workspaceId?: string;

  @IsIn(['brand-brain', 'content', 'campaign', 'whatsapp-menu'])
  form: FormSuggestionType;

  @IsString()
  fieldKey: string;

  @IsOptional()
  @IsString()
  currentValue?: string;

  @IsOptional()
  @IsString()
  variationSeed?: string;

  /** Prior AI outputs to avoid repeating on regenerate */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  avoidTexts?: string[];
}
