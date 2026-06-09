import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsPhoneNumber,
  IsString,
  MinLength,
} from 'class-validator';
import { Column } from 'typeorm';

import { Trim } from '../../../decorators/transform.decorators';

export class UserRegisterDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({
    message: 'First name is required',
  })
  @Trim()
  readonly firstName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({
    message: 'Last name is required',
  })
  @Trim()
  readonly lastName: string;

  @ApiProperty()
  @IsString()
  @IsEmail(
    {},
    {
      message: 'Invalid email',
    },
  )
  @IsNotEmpty({
    message: 'Email is required',
  })
  @Trim()
  readonly email: string;

  @ApiProperty()
  @Column()
  @IsPhoneNumber('ZM', {
    message: 'Invalid phone number',
  })
  phone: string;

  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6)
  @IsNotEmpty({
    message: 'Password is required',
  })
  readonly password: string;

  @ApiProperty()
  @IsString()
  readonly provider: string;

  @ApiProperty()
  @IsString()
  readonly providerId: string;
}
