import axios from 'axios';
import { SmsService } from './sms.service';

jest.mock('axios');
jest.mock('../system_settings/services/platform-integrations.service', () => ({
  PlatformIntegrationsService: class {},
}));

const post = axios.post as jest.Mock;
const reply = (status: number, data?: unknown) => ({ status, data });
const accepted = reply(202, {
  success: true,
  message: 'SMS accepted',
  data: { status: 'Queued', sent: 1, failed: 0, message_ids: [1842] },
});

const setup = (settings: Record<string, string> = { TRINOLUX_API_KEY: 'secret', TRINOLUX_SENDER_ID: 'Mako' }) =>
  new SmsService({
    getIntegrationWithEnvFallback: async (key: string) => settings[key],
  } as any);

const send = (service = setup()) => service.send({ to: '0971234567', message: ' Hello ' });

describe('SmsService', () => {
  beforeEach(() => {
    post.mockReset();
    jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void) => {
      fn();
      return 0;
    }) as any);
  });
  afterEach(() => jest.restoreAllMocks());

  it('sends the documented request', async () => {
    post.mockResolvedValue(accepted);
    await send();
    const [url, body, options] = post.mock.calls[0];
    expect(url).toBe('https://sms-api.trinolux.com/v1/sms/send');
    expect(body).toEqual({
      sender_id: 'Mako',
      to: ['260971234567'],
      message: 'Hello',
      message_type: 'SMS',
    });
    expect(options.headers['X-API-KEY']).toBe('secret');
    expect(options.headers['Idempotency-Key']).toBeTruthy();
  });

  it('reports acceptance, not delivery', async () => {
    post.mockResolvedValue(accepted);
    await expect(send()).resolves.toEqual({
      accepted: true,
      status: 'Queued',
      messageIds: [1842],
    });
  });

  it('uses an overridden API address', async () => {
    post.mockResolvedValue(accepted);
    await send(
      setup({ TRINOLUX_API_KEY: 'k', TRINOLUX_SENDER_ID: 'M', TRINOLUX_API_URL: 'https://x.test/v2/' }),
    );
    expect(post.mock.calls[0][0]).toBe('https://x.test/v2/sms/send');
  });

  it('makes no request when not configured', async () => {
    await expect(send(setup({}))).rejects.toThrow('not configured');
    expect(post).not.toHaveBeenCalled();
  });

  it.each([
    [{ to: 'nope', message: 'hi' }, 'valid Zambian'],
    [{ to: '+27821234567', message: 'hi' }, 'valid Zambian'],
    [{ to: '0971234567', message: '   ' }, 'Enter a message'],
    [{ to: '0971234567', message: 'x'.repeat(161) }, '160 characters'],
  ])('rejects %j before contacting Trinolux', async (params, error) => {
    await expect(setup().send(params)).rejects.toThrow(error);
    expect(post).not.toHaveBeenCalled();
  });

  it('allows exactly 160 characters', async () => {
    post.mockResolvedValue(accepted);
    await expect(setup().send({ to: '0971234567', message: 'x'.repeat(160) })).resolves.toBeTruthy();
  });

  it.each([
    ['429', reply(429, { success: false, data: { retry_after_seconds: 1 } })],
    ['503', reply(503, { success: false })],
  ])('retries %s with the same idempotency key', async (_name, failure) => {
    post.mockResolvedValueOnce(failure).mockResolvedValue(accepted);
    await send();
    expect(post).toHaveBeenCalledTimes(2);
    const keys = post.mock.calls.map(([, , options]) => options.headers['Idempotency-Key']);
    expect(keys[0]).toBe(keys[1]);
  });

  it('retries a timeout with the same idempotency key', async () => {
    post.mockRejectedValueOnce(new Error('timeout')).mockResolvedValue(accepted);
    await expect(send()).resolves.toMatchObject({ accepted: true });
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('honours retry_after_seconds', async () => {
    post
      .mockResolvedValueOnce(reply(429, { data: { retry_after_seconds: 7 } }))
      .mockResolvedValue(accepted);
    await send();
    expect((global.setTimeout as unknown as jest.Mock).mock.calls.some(([, ms]) => ms === 7000)).toBe(true);
  });

  it('gives up after three attempts', async () => {
    post.mockResolvedValue(reply(500, { success: false }));
    await expect(send()).rejects.toThrow('unavailable');
    expect(post).toHaveBeenCalledTimes(3);
  });

  it.each([400, 402, 404, 422])('never retries a %i', async (status) => {
    post.mockResolvedValue(reply(status, { success: false, message: 'insufficient balance' }));
    await expect(send()).rejects.toThrow('insufficient balance');
    expect(post).toHaveBeenCalledTimes(1);
  });

  it.each([401, 403])('never retries a %i and points to the key', async (status) => {
    post.mockResolvedValue(reply(status, { success: false }));
    await expect(send()).rejects.toThrow('API key');
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('trusts the status code over a success flag', async () => {
    post.mockResolvedValue(reply(202, { success: false, message: 'rejected' }));
    await expect(send()).rejects.toThrow('rejected');
  });

  it('does not report a partial failure as accepted', async () => {
    post.mockResolvedValue(
      reply(202, { success: true, message: 'failed', data: { status: 'Partial', sent: 0, failed: 1 } }),
    );
    await expect(send()).rejects.toThrow();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('never puts the key, number or message in a log', async () => {
    const logged: string[] = [];
    const spy = (args: unknown[]) => logged.push(JSON.stringify(args));
    const { Logger } = jest.requireActual('@nestjs/common');
    jest.spyOn(Logger.prototype, 'log').mockImplementation((...a: unknown[]) => spy(a));
    jest.spyOn(Logger.prototype, 'error').mockImplementation((...a: unknown[]) => spy(a));
    post.mockRejectedValue(Object.assign(new Error('x'), { config: { headers: { 'X-API-KEY': 'secret' } } }));
    await expect(send()).rejects.toThrow();
    post.mockResolvedValue(accepted);
    await send();
    const output = logged.join(' ');
    expect(logged.length).toBeGreaterThan(0);
    expect(output).not.toContain('secret');
    expect(output).not.toContain('260971234567');
    expect(output).not.toContain('Hello');
  });
});
