import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserEntity } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { resolveFrontendUrl } from '../../common/env-urls.util';
import { LoginPayloadDto } from './dtos/login-payload.dto';
import { UserDto } from '../user/dtos/user.dto';
import { AuthProfileDto } from './dtos/auth-profile.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { RefreshTokenService } from './refresh-token.service';
import { MailService } from '../mail/mail.service';
import { TenantBootstrapService } from '../tenants/tenant-bootstrap.service';
import { TenantSummaryDto } from '../tenants/dto/tenant-summary.dto';
import { TenantMembersService } from '../tenant_members/tenant_members.service';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
    private readonly tenantBootstrap: TenantBootstrapService,
    private readonly tenantMembers: TenantMembersService,
  ) {}

  async completeAuthentication(user: UserEntity): Promise<LoginPayloadDto> {
    const tenant = await this.tenantBootstrap.bootstrapForUser(user);
    if (user.email) {
      await this.tenantMembers.acceptPendingInvitations(user.id, user.email);
    }
    const tokens = await this.issueTokensForUser(user);
    return {
      ...tokens,
      tenant: TenantSummaryDto.fromEntity(tenant),
    };
  }

  async issueTokensForUser(user: UserEntity): Promise<LoginPayloadDto> {
    const payload = { sub: String(user.id), provider: user.provider ?? 'local' };
    const token = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign({ ...payload, type: 'refresh' }, { expiresIn: '7d' });

    await this.refreshTokenService.save(
      String(user.id),
      refreshToken,
      new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    );

    const userDto = new UserDto({ ...user, token });
    return { user: userDto, token, refreshToken };
  }

  async refresh(refreshToken: string) {
    try {
      const decoded: any = this.jwtService.verify(refreshToken);
      if (decoded.type !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token type');
      }

      const userId = String(decoded.sub);
      const valid = await this.refreshTokenService.isValid(userId, refreshToken);
      if (!valid) {
        throw new UnauthorizedException('Refresh token revoked');
      }

      const newAccessToken = this.jwtService.sign({
        sub: decoded.sub,
        provider: decoded.provider,
      });
      return { accessToken: newAccessToken };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async register(registerDto: RegisterDto): Promise<LoginPayloadDto> {
    const existing = await this.userService.findOne({ email: registerDto.email });
    if (existing) throw new ConflictException('Email already registered');
    const user = await this.userService.createUser({
      email: registerDto.email,
      password: registerDto.password,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      provider: 'local',
    });
    return this.completeAuthentication(user);
  }

  async login(loginDto: LoginDto): Promise<LoginPayloadDto> {
    const user = await this.userService.findOne({ email: loginDto.email });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.provider !== 'local' || !user.password) {
      throw new UnauthorizedException('Please login using social login');
    }
    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');
    return this.completeAuthentication(user);
  }

  async revokeRefreshToken(userId: string) {
    await this.refreshTokenService.revoke(String(userId));
  }

  async getUserProfile(userId: string): Promise<AuthProfileDto> {
    const user = await this.userService.findOne({ id: userId });
    if (!user) throw new UnauthorizedException('User not found');
    const tenant = await this.tenantBootstrap.bootstrapForUser(user);
    return AuthProfileDto.from(user, tenant);
  }

  async requestPasswordReset(forgotPasswordDto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.userService.findOne({ email: forgotPasswordDto.email });
    if (!user) throw new NotFoundException('User not found');
    if (user.provider !== 'local') {
      throw new BadRequestException('Please use social login to access your account');
    }

    const resetToken = this.jwtService.sign({ sub: user.id, type: 'reset' }, { expiresIn: '1h' });
    const frontendUrl = resolveFrontendUrl(this.config);
    const resetLink = `${frontendUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;

    await this.mailService.sendPasswordResetEmail(user.email!, resetLink);

    return { message: 'If your email is registered, you will receive a password reset link.' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    let payload: any;
    try {
      payload = this.jwtService.verify(resetPasswordDto.token);
      if (payload.type !== 'reset') throw new Error();
    } catch {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const userId = payload.sub;
    const user = await this.userService.findOne({ id: userId });
    if (!user || user.provider !== 'local') {
      throw new BadRequestException('Invalid reset request');
    }

    const hashedPassword = await bcrypt.hash(resetPasswordDto.newPassword, 10);
    await this.userService.updatePassword(user.id, hashedPassword);
    await this.refreshTokenService.revoke(String(user.id));

    return { message: 'Password successfully reset. You can now log in with your new password.' };
  }
}
