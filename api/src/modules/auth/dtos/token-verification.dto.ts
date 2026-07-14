import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class TokenVerificationDto {
  @IsString()
  @ApiProperty()
  readonly token: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  readonly refreshToken?: string;
}
