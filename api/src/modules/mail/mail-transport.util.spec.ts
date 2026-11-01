import { mailFromAddress, mailTransportOptions } from './mail-transport.util';

const configWith = (values: Record<string, string | number>) =>
  ({ get: (key: string, fallback?: unknown) => values[key] ?? fallback }) as any;

describe('mailTransportOptions', () => {
  it('uses direct TLS on port 465', () => {
    expect(mailTransportOptions(configWith({ MAIL_PORT: '465' }))).toMatchObject({
      port: 465,
      secure: true,
      requireTLS: false,
    });
  });

  it('requires STARTTLS on port 587', () => {
    expect(mailTransportOptions(configWith({ MAIL_PORT: '587' }))).toMatchObject({
      port: 587,
      secure: false,
      requireTLS: true,
    });
  });

  it('defaults to port 587 with TLS required', () => {
    expect(mailTransportOptions(configWith({}))).toMatchObject({ port: 587, requireTLS: true });
  });

  it('passes host and credentials through', () => {
    expect(
      mailTransportOptions(
        configWith({ MAIL_HOST: 'smtppro.zoho.com', MAIL_USERNAME: 'u', MAIL_PASSWORD: 'p' }),
      ),
    ).toMatchObject({ host: 'smtppro.zoho.com', auth: { user: 'u', pass: 'p' } });
  });
});

describe('mailFromAddress', () => {
  it('adds the display name', () => {
    expect(
      mailFromAddress(configWith({ MAIL_FROM: 'support@x.co', MAIL_FROM_NAME: 'Mako' })),
    ).toBe('"Mako" <support@x.co>');
  });

  it('uses the plain address with no name', () => {
    expect(mailFromAddress(configWith({ MAIL_FROM: 'support@x.co' }))).toBe('support@x.co');
  });

  it('leaves an already formatted sender alone', () => {
    expect(
      mailFromAddress(configWith({ MAIL_FROM: '"Tekrem" <a@x.co>', MAIL_FROM_NAME: 'Mako' })),
    ).toBe('"Tekrem" <a@x.co>');
  });

  it('strips characters that could inject headers', () => {
    expect(
      mailFromAddress(configWith({ MAIL_FROM: 'a@x.co', MAIL_FROM_NAME: 'Ma"ko\r\nBcc: x' })),
    ).toBe('"MakoBcc: x" <a@x.co>');
  });

  it('is undefined when no address is set', () => {
    expect(mailFromAddress(configWith({ MAIL_FROM_NAME: 'Mako' }))).toBeUndefined();
  });
});
