import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendTestSmsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  to: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  message: string;
}
