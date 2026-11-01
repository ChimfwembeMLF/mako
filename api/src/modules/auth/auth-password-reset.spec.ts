import { BadRequestException, ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({ hash: jest.fn(async () => 'new-hash'), compare: jest.fn() }));
jest.mock('uuid', () => ({ v4: () => 'id' }));

const local = (over: Record<string, unknown> = {}): Record<string, any> => ({
  id: 'u1',
  email: 'a@x.co',
  provider: 'local',
  phone: '260971234567',
  phoneVerifiedAt: new Date(),
  ...over,
});

const setup = (user: unknown = local()) => {
  const users = {
    findOne: jest.fn(async () => user),
    updatePassword: jest.fn(),
    save: jest.fn(async (u) => u),
  };
  const mail = { sendPasswordResetEmail: jest.fn(async () => undefined) };
  const phoneCodes = { send: jest.fn(async () => undefined), verify: jest.fn(async () => true) };
  const refresh = { revoke: jest.fn() };
  const service = Object.create(AuthService.prototype);
  Object.assign(service, {
    userService: users,
    mailService: mail,
    phoneCodes,
    refreshTokenService: refresh,
    jwtService: { sign: () => 'token' },
    config: { get: () => 'https://mako.test' },
    logger: { warn: jest.fn() },
  });
  return { service, users, mail, phoneCodes, refresh };
};

const generic = { message: 'If that account exists, we have sent password reset instructions.' };

describe('password reset', () => {
  beforeAll(() => {
    process.env.FRONTEND_URL = 'https://mako.test';
  });

  it('sends email and SMS to a verified account', async () => {
    const { service, mail, phoneCodes } = setup();
    await expect(service.requestPasswordReset({ email: 'a@x.co' })).resolves.toEqual(generic);
    expect(mail.sendPasswordResetEmail).toHaveBeenCalled();
    expect(phoneCodes.send).toHaveBeenCalledWith(expect.anything(), 'reset_password', '260971234567');
  });

  it('sends email only without a verified number', async () => {
    const { service, mail, phoneCodes } = setup(local({ phoneVerifiedAt: null }));
    await service.requestPasswordReset({ email: 'a@x.co' });
    expect(mail.sendPasswordResetEmail).toHaveBeenCalled();
    expect(phoneCodes.send).not.toHaveBeenCalled();
  });

  it.each([
    ['an unknown email', null],
    ['a social account', local({ provider: 'google' })],
  ])('gives the same answer for %s and sends nothing', async (_name, user) => {
    const { service, mail, phoneCodes } = setup(user);
    await expect(service.requestPasswordReset({ email: 'a@x.co' })).resolves.toEqual(generic);
    expect(mail.sendPasswordResetEmail).not.toHaveBeenCalled();
    expect(phoneCodes.send).not.toHaveBeenCalled();
  });

  it('still answers normally when SMS fails, so email remains the fallback', async () => {
    const { service, phoneCodes } = setup();
    phoneCodes.send.mockRejectedValue(new Error('trinolux down'));
    await expect(service.requestPasswordReset({ email: 'a@x.co' })).resolves.toEqual(generic);
  });

  it('still sends SMS when email fails', async () => {
    const { service, mail, phoneCodes } = setup();
    mail.sendPasswordResetEmail.mockRejectedValue(new Error('smtp down'));
    await service.requestPasswordReset({ email: 'a@x.co' });
    expect(phoneCodes.send).toHaveBeenCalled();
  });

  it('resets the password with a valid code and ends sessions', async () => {
    const { service, users, refresh } = setup();
    await service.resetPasswordWithCode({ email: 'a@x.co', code: '123456', newPassword: 'newpass1' });
    expect(users.updatePassword).toHaveBeenCalledWith('u1', 'new-hash');
    expect(refresh.revoke).toHaveBeenCalledWith('u1');
  });

  it('rejects a wrong code', async () => {
    const { service, users, phoneCodes } = setup();
    phoneCodes.verify.mockResolvedValue(false);
    await expect(
      service.resetPasswordWithCode({ email: 'a@x.co', code: '000000', newPassword: 'newpass1' }),
    ).rejects.toThrow('Invalid or expired code');
    expect(users.updatePassword).not.toHaveBeenCalled();
  });

  it.each([
    ['an unknown email', null],
    ['an unverified number', local({ phoneVerifiedAt: null })],
    ['a social account', local({ provider: 'google' })],
  ])('gives the same error for %s', async (_name, user) => {
    const { service, phoneCodes } = setup(user);
    await expect(
      service.resetPasswordWithCode({ email: 'a@x.co', code: '123456', newPassword: 'newpass1' }),
    ).rejects.toThrow('Invalid or expired code');
    expect(phoneCodes.verify).not.toHaveBeenCalled();
  });
});

describe('phone verification', () => {
  const unverified = () => local({ phone: null, phoneVerifiedAt: null, pendingPhone: null });

  it('normalises the number and sends a code', async () => {
    const user = unverified();
    const { service, users, phoneCodes } = setup(user);
    users.findOne.mockResolvedValueOnce(user).mockResolvedValueOnce(null);
    await service.sendPhoneCode('u1', '0971234567');
    expect(user.pendingPhone).toBe('260971234567');
    expect(phoneCodes.send).toHaveBeenCalledWith(user, 'verify_phone', '260971234567');
  });

  it('rejects an invalid number', async () => {
    const { service, phoneCodes } = setup(unverified());
    await expect(service.sendPhoneCode('u1', '+27821234567')).rejects.toBeInstanceOf(BadRequestException);
    expect(phoneCodes.send).not.toHaveBeenCalled();
  });

  it("refuses a number verified by someone else", async () => {
    const { service, users, phoneCodes } = setup();
    users.findOne.mockResolvedValueOnce(unverified()).mockResolvedValueOnce(local({ id: 'other' }));
    await expect(service.sendPhoneCode('u1', '0971234567')).rejects.toBeInstanceOf(ConflictException);
    expect(phoneCodes.send).not.toHaveBeenCalled();
  });

  it('marks the number verified only after a correct code', async () => {
    const user: Record<string, any> = { ...unverified(), pendingPhone: '260971234567' };
    const { service } = setup(user);
    await service.verifyPhoneCode('u1', '123456');
    expect(user.phone).toBe('260971234567');
    expect(user.phoneVerifiedAt).toBeInstanceOf(Date);
    expect(user.pendingPhone).toBeNull();
  });

  it('keeps the old number when the code is wrong', async () => {
    const user = local({ pendingPhone: '260961111111' });
    const { service, phoneCodes } = setup(user);
    phoneCodes.verify.mockResolvedValue(false);
    await expect(service.verifyPhoneCode('u1', '000000')).rejects.toThrow('Invalid or expired');
    expect(user.phone).toBe('260971234567');
  });
});
