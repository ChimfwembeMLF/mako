import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { RefreshTokenService } from './refresh-token.service';
import { MailService } from '../mail/mail.service';
import { TenantBootstrapService } from '../tenants/tenant-bootstrap.service';
import { TenantMembersService } from '../tenant_members/tenant_members.service';
import { RolesGuard } from './guards/roles.guard';
import { Reflector } from '@nestjs/core';
import { RbacService } from './rbac/rbac.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: { sign: jest.fn(), verify: jest.fn() },
        },
        { provide: UserService, useValue: {} },
        {
          provide: RefreshTokenService,
          useValue: { save: jest.fn(), isValid: jest.fn(), revoke: jest.fn() },
        },
        {
          provide: MailService,
          useValue: { sendPasswordResetEmail: jest.fn() },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        {
          provide: TenantBootstrapService,
          useValue: { bootstrapForUser: jest.fn() },
        },
        {
          provide: TenantMembersService,
          useValue: { acceptPendingInvitations: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should include active tenant and role in access-token payloads', async () => {
    const sign = jest.fn().mockReturnValue('signed-token');
    const module = await Test.createTestingModule({
      providers: [{ provide: JwtService, useValue: { sign, verify: jest.fn() } }],
    }).compile();
    const jwtService = module.get(JwtService);

    const user = {
      id: 'user-123',
      provider: 'local',
      email: 'user@example.com',
      role: 'USER',
    } as any;

    const tenant = { id: 'tenant-456' } as any;

    const serviceWithJwt = new AuthService(
      jwtService,
      {} as UserService,
      { save: jest.fn().mockResolvedValue(undefined) } as any,
      {} as MailService,
      { get: jest.fn().mockReturnValue('7d') } as any,
      {} as TenantBootstrapService,
      {} as TenantMembersService,
    );

    await serviceWithJwt.issueTokensForUser(user, tenant);

    expect(sign).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-123',
        sub: 'user-123',
        provider: 'local',
        role: 'USER',
        tenantId: 'tenant-456',
      }),
    );
  });

  it('should allow authenticated users without tenant info through role checks for personal routes', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['USER']) } as any;
    const rbac = { hasRoles: jest.fn() } as any;
    const guard = new RolesGuard(reflector, rbac);

    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user: { sub: 'user-123' } }),
      }),
    } as any;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(rbac.hasRoles).not.toHaveBeenCalled();
  });
});
