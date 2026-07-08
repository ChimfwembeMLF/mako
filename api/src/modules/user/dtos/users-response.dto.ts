import { Type } from 'class-transformer';

import { PageResponseDto } from 'src/common/dtos/page-response.dto';
import { UserDto } from './user.dto';

export class UsersResponseDto extends PageResponseDto<UserDto> {
  @Type(() => UserDto)
  data: UserDto[];
}
