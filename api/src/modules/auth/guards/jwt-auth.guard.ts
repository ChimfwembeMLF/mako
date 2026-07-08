import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

/**
 * JwtAuthGuard validates the JWT token attached to the request via the
 * Passport JWT strategy. If the token is missing or invalid, an
 * UnauthorizedException is thrown.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  // Optionally you can add custom logic here – e.g., checking for revoked tokens.
  // For now we just rely on the Passport strategy.

  canActivate(context: ExecutionContext) {
    // Let Passport handle the validation first.
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid or missing JWT');
    }
    return user;
  }
}
