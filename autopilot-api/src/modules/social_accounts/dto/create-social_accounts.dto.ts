import {
  IsString,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsDate,
  IsObject,
} from 'class-validator';

export class SocialAccountsCreateDto {
  @IsUUID()
  tenantId: string;

  @IsOptional()
  @IsUUID()
  workspaceId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsString()
  platform: string; // facebook | instagram | linkedin

  @IsString()
  accountName: string;

  @IsOptional()
  @IsString()
  externalId?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsString()
  accessToken: string;

  @IsOptional()
  @IsString()
  refreshToken?: string;

  @IsOptional()
  @IsDate()
  expiresAt?: Date;

  @IsOptional()
  @IsBoolean()
  connected?: boolean;

  @IsOptional()
  metadata?: Record<string, any>;
}
