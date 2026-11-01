import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class SendPhoneCodeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone: string;
}

export class VerifyPhoneCodeDto {
  @ApiProperty()
  @IsString()
  @Length(6, 6)
  code: string;
}

export class ResetPasswordWithCodeDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @Length(6, 6)
  code: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  newPassword: string;
}
