import {
  BadRequestException,
  ConflictException,
  Logger,
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
import { ResetPasswordWithCodeDto } from './dto/phone-code.dto';
import { PhoneCodeService } from './phone-code.service';
import { maskNumber, normalizeZambianNumber } from '../sms/sms-number.util';
import { SmsService } from '../sms/sms.service';
import { IsNull, Not } from 'typeorm';
import { RefreshTokenService } from './refresh-token.service';
import { MailService } from '../mail/mail.service';
import { TenantBootstrapService } from '../tenants/tenant-bootstrap.service';
import { TenantSummaryDto } from '../tenants/dto/tenant-summary.dto';
import { TenantMembersService } from '../tenant_members/tenant_members.service';
import { RoleType } from '../../constants';

function parseDurationToMs(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 7 * 24 * 60 * 60 * 1000;
  }
}

const DEFAULT_REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
    private readonly tenantBootstrap: TenantBootstrapService,
    private readonly tenantMembers: TenantMembersService,
    private readonly phoneCodes: PhoneCodeService,
    private readonly sms: SmsService,
  ) {}

  async completeAuthentication(user: UserEntity): Promise<LoginPayloadDto> {
    const tenant = await this.tenantBootstrap.bootstrapForUser(user);
    if (user.email) {
      await this.tenantMembers.acceptPendingInvitations(user.id, user.email);
    }
    const tokens = await this.issueTokensForUser(user, tenant);
    return {
      ...tokens,
      tenant: TenantSummaryDto.fromEntity(tenant),
    };
  }

  async issueTokensForUser(
    user: UserEntity,
    tenant?: { id?: string | null } | null,
  ): Promise<LoginPayloadDto> {
    const payload = {
      id: String(user.id),
      sub: String(user.id),
      provider: user.provider ?? 'local',
      role: String(user.role ?? RoleType.USER),
      ...(tenant?.id ? { tenantId: String(tenant.id) } : {}),
    };
    const token = this.jwtService.sign(payload);
    const refreshExpiry = this.config.get<string>('JWT_REFRESH_EXPIRY')?.trim() || '7d';
    const ttlMs = parseDurationToMs(refreshExpiry);

    const refreshToken = this.jwtService.sign(
      { ...payload, type: 'refresh' },
      { expiresIn: refreshExpiry as any },
    );

    await this.refreshTokenService.save(
      String(user.id),
      refreshToken,
      new Date(Date.now() + ttlMs),
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
      const valid = await this.refreshTokenService.isValid(
        userId,
        refreshToken,
      );
      if (!valid) {
        throw new UnauthorizedException('Refresh token revoked');
      }

      const newAccessToken = this.jwtService.sign({
        id: decoded.id ?? decoded.sub,
        sub: decoded.sub,
        provider: decoded.provider,
        role: decoded.role ?? RoleType.USER,
        ...(decoded.tenantId ? { tenantId: String(decoded.tenantId) } : {}),
      });
      return { accessToken: newAccessToken };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async register(registerDto: RegisterDto): Promise<LoginPayloadDto> {
    const existing = await this.userService.findOne({
      email: registerDto.email,
    });
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
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!isPasswordValid)
      throw new UnauthorizedException('Invalid credentials');
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

  /**
   * Always gives the same answer, so this can't reveal who has an account. Email is sent
   * every time: it's the fallback for anyone without a verified number or during an SMS outage.
   */
  async requestPasswordReset(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    const response = {
      message:
        'If that account exists, we have sent password reset instructions.',
    };
    const user = await this.userService.findOne({
      email: forgotPasswordDto.email,
    });
    if (!user || user.provider !== 'local') return response;

    const resetToken = this.jwtService.sign(
      { sub: user.id, type: 'reset' },
      { expiresIn: '1h' },
    );
    const frontendUrl = resolveFrontendUrl(this.config);
    const resetLink = `${frontendUrl}/reset-password?token=${encodeURIComponent(
      resetToken,
    )}`;

    try {
      await this.mailService.sendPasswordResetEmail(user.email!, resetLink);
    } catch {
      this.logger.warn(`Password reset email failed for user ${user.id}`);
    }
    if (user.phoneVerifiedAt && user.phone) {
      try {
        await this.phoneCodes.send(user, 'reset_password', user.phone);
      } catch {
        this.logger.warn(`Password reset SMS failed for user ${user.id}`);
      }
    }

    return response;
  }

  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
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

    return {
      message:
        'Password successfully reset. You can now log in with your new password.',
    };
  }

  /** One message for every failure, so a guess can't reveal which part was wrong. */
  async resetPasswordWithCode(
    dto: ResetPasswordWithCodeDto,
  ): Promise<{ message: string }> {
    const user = await this.userService.findOne({ email: dto.email });
    const valid =
      user?.provider === 'local' &&
      user.phoneVerifiedAt &&
      (await this.phoneCodes.verify(user, 'reset_password', dto.code));
    if (!user || !valid) {
      throw new BadRequestException('Invalid or expired code');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.userService.updatePassword(user.id, hashedPassword);
    await this.refreshTokenService.revoke(String(user.id));
    return {
      message:
        'Password successfully reset. You can now log in with your new password.',
    };
  }

  async phoneVerificationStatus(userId: string) {
    const user = await this.userService.findOne({ id: userId });
    return {
      available: await this.sms.isConfigured(),
      verified: Boolean(user?.phoneVerifiedAt),
      phone:
        user?.phoneVerifiedAt && user.phone ? maskNumber(user.phone) : null,
    };
  }

  async sendPhoneCode(userId: string, input: string): Promise<{ sent: true }> {
    const phone = normalizeZambianNumber(input);
    if (!phone) {
      throw new BadRequestException('Enter a valid Zambian mobile number');
    }
    const user = await this.userService.findOne({ id: userId });
    if (!user) throw new UnauthorizedException('User not found');

    // Reset codes go to verified numbers, so one number can't serve two accounts.
    const owner = await this.userService.findOne({
      phone,
      phoneVerifiedAt: Not(IsNull()),
    });
    if (owner && owner.id !== user.id) {
      throw new ConflictException('This number is already in use');
    }

    user.pendingPhone = phone;
    await this.phoneCodes.send(user, 'verify_phone', phone);
    return { sent: true };
  }

  async verifyPhoneCode(userId: string, code: string): Promise<{ verified: true }> {
    const user = await this.userService.findOne({ id: userId });
    if (!user?.pendingPhone) {
      throw new BadRequestException('Request a new code');
    }
    if (!(await this.phoneCodes.verify(user, 'verify_phone', code))) {
      throw new BadRequestException('Invalid or expired code');
    }

    user.phone = user.pendingPhone;
    user.phoneVerifiedAt = new Date();
    user.pendingPhone = null;
    await this.userService.save(user);
    return { verified: true };
  }
}
