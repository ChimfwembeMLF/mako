import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class ScrapeWebsiteDto {
  @IsUrl({}, { message: 'url must be a valid URL' })
  url: string;

  @IsOptional()
  @IsString()
  tenantId?: string;
}
