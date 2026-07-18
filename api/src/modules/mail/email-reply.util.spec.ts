import {
  isMarketingOrBulkEmail,
  sanitizeInboundEmailBody,
} from './email-reply.util';

describe('email-reply.util', () => {
  it('strips quoted reply chains', () => {
    const body = sanitizeInboundEmailBody(
      'Hi, can we meet Tuesday?\n\nOn Mon, John wrote:\n> Old thread',
    );
    expect(body).toBe('Hi, can we meet Tuesday?');
  });

  it('detects newsletter / marketing email', () => {
    expect(
      isMarketingOrBulkEmail({
        subject: 'CFI courses for finance pros',
        body: 'Learn more. Unsubscribe here.',
        listUnsubscribe: '<mailto:list@cfi.co>',
      }),
    ).toBe(true);
  });

  it('does not flag a direct personal inquiry', () => {
    expect(
      isMarketingOrBulkEmail({
        subject: 'Project timeline',
        body: 'Hi Chimfwembe, can you share an update on the API work?',
      }),
    ).toBe(false);
  });
});
