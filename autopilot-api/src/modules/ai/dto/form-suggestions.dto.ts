import { IsArray, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
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
}
