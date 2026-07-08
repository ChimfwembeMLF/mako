import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class WhatsappFinalizeDto {
  @ApiProperty({ description: 'Short-lived setup token from OAuth callback' })
  @IsString()
  @IsNotEmpty()
  setupToken: string;

  @ApiProperty({ description: 'Selected WhatsApp phone number ID from Meta' })
  @IsString()
  @IsNotEmpty()
  phoneNumberId: string;
}
