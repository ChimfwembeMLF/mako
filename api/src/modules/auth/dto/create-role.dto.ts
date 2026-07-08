import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString({ each: true })
  permissions?: string[];
}
