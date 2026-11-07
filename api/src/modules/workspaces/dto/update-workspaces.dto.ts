import { IsString, IsOptional, IsUUID } from 'class-validator';

export class WorkspacesUpdateDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  /** Send null to remove the logo. */
  @IsOptional()
  @IsString()
  logoUrl?: string | null;
}
