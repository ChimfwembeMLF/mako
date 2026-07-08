import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { UserEntity } from '../../user/user.entity';
import { UserService } from '../../user/user.service';

type JwtPayload = {
  email: string;
  id?: number;
  role?: string;
  firstname?: string;
  lastname?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly userService: UserService,
    private readonly config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      // ignoreExpiration: false, // default
    });
  }

  async validate(payload: JwtPayload): Promise<UserEntity> {
    if (!payload?.email) {
      throw new UnauthorizedException('Unauthorized access');
    }

    const user = await this.userService.findOne({ email: payload.email });

    if (!user) {
      throw new UnauthorizedException('Unauthorized access');
    }

    return user;
  }
}
