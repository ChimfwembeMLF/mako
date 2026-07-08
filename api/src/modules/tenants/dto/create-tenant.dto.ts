import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  subdomain: string;

  @IsString()
  @IsNotEmpty()
  ownerId: string;

  @IsString()
  @IsOptional()
  description?: string;
}
