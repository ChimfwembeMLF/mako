import { IsObject, IsOptional } from 'class-validator';

export class UpdatePreferencesDto {
  @IsObject()
  @IsOptional()
  tours?: Record<string, any>;

  // Allow any other preferences to pass through (using basic optional object decorators if needed)
}
