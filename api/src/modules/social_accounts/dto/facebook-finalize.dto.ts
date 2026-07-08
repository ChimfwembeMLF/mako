import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class FacebookFinalizeDto {
  @ApiProperty({ description: 'Short-lived setup token from OAuth callback' })
  @IsString()
  @IsNotEmpty()
  setupToken: string;

  @ApiProperty({ description: 'Selected Facebook Page ID' })
  @IsString()
  @IsNotEmpty()
  pageId: string;
}
