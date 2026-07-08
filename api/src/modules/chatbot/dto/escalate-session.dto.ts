import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class EscalateSessionDto {
  @IsString()
  @MinLength(1)
  userMessage!: string;

  @IsOptional()
  @IsEmail()
  visitorEmail?: string;
}
