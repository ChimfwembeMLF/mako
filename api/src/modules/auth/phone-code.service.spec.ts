import { PhoneCodeService } from './phone-code.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(async (code: string) => `hashed:${code}`),
  compare: jest.fn(async (code: string, hash: string) => hash === `hashed:${code}`),
}));
jest.mock('../sms/sms.service', () => ({ SmsService: class {} }));
jest.mock('../user/user.service', () => ({ UserService: class {} }));

const now = new Date('2026-11-01T12:00:00Z');
const later = (ms: number) => new Date(now.getTime() + ms);
const MINUTE = 60 * 1000;

const setup = () => {
  const users = { save: jest.fn(async (u) => u) };
  const sms = { send: jest.fn<Promise<unknown>, [{ to: string; type: string; message: string }]>(async () => ({ accepted: true })) };
  return { service: new PhoneCodeService(users as any, sms as any), users, sms };
};
const user = (over: Record<string, unknown> = {}) =>
  ({ id: 'u', phoneCodeAttempts: 0, phoneCodeSendCount: 0, ...over }) as any;
const sentCode = (sms: { send: jest.Mock }) =>
  /\b(\d{6})\b/.exec(sms.send.mock.calls[0][0].message)![1];

describe('PhoneCodeService', () => {
  it('sends a 6-digit OTP and stores only a hash', async () => {
    const { service, sms } = setup();
    const target = user();
    await service.send(target, 'verify_phone', '260971234567', now);
    const [{ to, type, message }] = sms.send.mock.calls[0];
    expect(to).toBe('260971234567');
    expect(type).toBe('OTP');
    expect(message).toMatch(/^Your Mako verification code is \d{6}\./);
    expect(message.length).toBeLessThanOrEqual(160);
    expect(JSON.stringify(target)).not.toContain(`"${sentCode(sms)}"`);
  });

  it('accepts the right code once', async () => {
    const { service, sms } = setup();
    const target = user();
    await service.send(target, 'reset_password', '260971234567', now);
    const code = sentCode(sms);
    await expect(service.verify(target, 'reset_password', code, later(MINUTE))).resolves.toBe(true);
    await expect(service.verify(target, 'reset_password', code, later(MINUTE))).resolves.toBe(false);
  });

  it('rejects a wrong code', async () => {
    const { service } = setup();
    const target = user();
    await service.send(target, 'reset_password', '260971234567', now);
    await expect(service.verify(target, 'reset_password', 'abcdef', now)).resolves.toBe(false);
  });

  it('rejects an expired code', async () => {
    const { service, sms } = setup();
    const target = user();
    await service.send(target, 'reset_password', '260971234567', now);
    await expect(
      service.verify(target, 'reset_password', sentCode(sms), later(10 * MINUTE + 1)),
    ).resolves.toBe(false);
  });

  it('does not let a code from one purpose work for another', async () => {
    const { service, sms } = setup();
    const target = user();
    await service.send(target, 'verify_phone', '260971234567', now);
    await expect(service.verify(target, 'reset_password', sentCode(sms), now)).resolves.toBe(false);
  });

  it('locks a code after five wrong guesses, even if the sixth is right', async () => {
    const { service, sms } = setup();
    const target = user();
    await service.send(target, 'reset_password', '260971234567', now);
    for (let i = 0; i < 5; i++) await service.verify(target, 'reset_password', 'nope', now);
    await expect(service.verify(target, 'reset_password', sentCode(sms), now)).resolves.toBe(false);
  });

  it('enforces a minute between sends', async () => {
    const { service, sms } = setup();
    const target = user();
    await service.send(target, 'verify_phone', '260971234567', now);
    await expect(service.send(target, 'verify_phone', '260971234567', later(30 * 1000))).rejects.toThrow('wait');
    expect(sms.send).toHaveBeenCalledTimes(1);
  });

  it('allows five sends an hour, then refuses until the window resets', async () => {
    const { service, sms } = setup();
    const target = user();
    for (let i = 0; i < 5; i++) await service.send(target, 'verify_phone', '260971234567', later(i * 2 * MINUTE));
    await expect(service.send(target, 'verify_phone', '260971234567', later(20 * MINUTE))).rejects.toThrow('wait');
    expect(sms.send).toHaveBeenCalledTimes(5);
    await expect(service.send(target, 'verify_phone', '260971234567', later(61 * MINUTE))).resolves.toBeUndefined();
  });

  it('never fails a verify when nothing was requested', async () => {
    const { service } = setup();
    await expect(service.verify(user(), 'reset_password', '123456', now)).resolves.toBe(false);
  });
});
