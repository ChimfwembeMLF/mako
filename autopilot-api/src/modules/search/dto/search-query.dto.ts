import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class SearchQueryDto {
  @IsUUID()
  tenantId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  q: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  types?: string;
}

export class SearchAskDto {
  @IsUUID()
  tenantId: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  q: string;
}
