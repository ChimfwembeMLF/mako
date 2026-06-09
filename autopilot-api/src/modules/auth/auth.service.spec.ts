import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { RefreshTokenService } from './refresh-token.service';
import { MailService } from '../mail/mail.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: { sign: jest.fn(), verify: jest.fn() } },
        { provide: UserService, useValue: {} },
        { provide: RefreshTokenService, useValue: { save: jest.fn(), isValid: jest.fn(), revoke: jest.fn() } },
        { provide: MailService, useValue: { sendPasswordResetEmail: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: TenantBootstrapService, useValue: { bootstrapForUser: jest.fn() } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
