import type { ConfigService } from '@nestjs/config';

/**
 * Works with any SMTP host. Port 465 is TLS from the first byte; other ports start
 * plain and must upgrade, so credentials are never sent unencrypted.
 */
export function mailTransportOptions(config: ConfigService) {
  const port = Number(config.get<string | number>('MAIL_PORT', 587));
  const secure = port === 465;
  return {
    host: config.get<string>('MAIL_HOST', 'smtp.mailgun.org'),
    port,
    secure,
    requireTLS: !secure,
    auth: {
      user: config.get<string>('MAIL_USERNAME'),
      pass: config.get<string>('MAIL_PASSWORD'),
    },
  };
}

/** Sender as `"Mako" <support@example.com>`. Zoho only accepts its own mailbox or alias here. */
export function mailFromAddress(config: ConfigService): string | undefined {
  const address = config.get<string>('MAIL_FROM')?.trim();
  const name = config.get<string>('MAIL_FROM_NAME')?.trim();
  if (!address || !name || address.includes('<')) return address;
  return `"${name.replace(/["\\\r\n]/g, '')}" <${address}>`;
}
