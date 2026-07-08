import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class YoutubeFinalizeDto {
  @ApiProperty({ description: 'Short-lived setup token from OAuth callback' })
  @IsString()
  @IsNotEmpty()
  setupToken: string;

  @ApiProperty({ description: 'Selected YouTube channel ID' })
  @IsString()
  @IsNotEmpty()
  channelId: string;
}
