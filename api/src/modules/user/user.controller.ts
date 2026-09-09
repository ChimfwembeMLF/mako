import { Controller, Get, Post, Body, Req, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { PageMetaDto, PageOptionsDto } from 'src/common/dtos';
import { RoleType } from 'src/constants';
import { Auth } from 'src/decorators';

import { UserDto } from './dtos/user.dto';
import { UsersResponseDto } from './dtos/users-response.dto';
import { UserService } from './user.service';
import { RegisterPushTokenDto } from './dtos/register-push-token.dto';
import type { Request } from 'express';
import { UserEntity } from './user.entity';

@Controller('api/v1/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Auth([RoleType.USER])
  @Get()
  @HttpCode(HttpStatus.OK)
  async getUsers(@Query() pageOptionsDto: PageOptionsDto) {
    const [itemCount, data] = await this.userService.getUsers(pageOptionsDto);
    const pageMetaDto = new PageMetaDto({ itemCount, pageOptionsDto });
    const users = data.map((user) => new UserDto(user));
    const userDto = UsersResponseDto.from(users, pageMetaDto);
    userDto.message = 'Users retrieved successfully';
    return userDto;
  }

  @Auth([RoleType.USER])
  @Post('push-tokens')
  @HttpCode(HttpStatus.OK)
  async registerPushToken(
    @Req() req: any,
    @Body() dto: RegisterPushTokenDto,
  ) {
    const user = req.user as UserEntity;
    await this.userService.registerPushToken(user.id, dto.token, dto.deviceName, dto.platform);
    return { success: true, message: 'Push token registered successfully' };
  }
}
