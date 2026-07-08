import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class TokenVerificationDto {
  @IsString()
  @ApiProperty()
  readonly token: string;
}
