import { IsString, IsOptional, IsUUID } from 'class-validator';

export class WorkspacesCreateDto {
  @IsUUID()
  tenantId: string;

  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;
}
