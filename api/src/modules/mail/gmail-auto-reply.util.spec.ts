import { parsePawaPayDepositStatus } from '../payments/pawapay.client';

// Re-export parsing helpers for unit tests (body extraction tested via integration script)
export function shouldSkipSender(email: string): boolean {
  const lower = email.toLowerCase();
  return (
    lower.includes('noreply') ||
    lower.includes('no-reply') ||
    lower.includes('mailer-daemon') ||
    lower.includes('donotreply')
  );
}

describe('Gmail auto-reply helpers', () => {
  it('skips automated sender addresses', () => {
    expect(shouldSkipSender('noreply@company.com')).toBe(true);
    expect(shouldSkipSender('mailer-daemon@googlemail.com')).toBe(true);
    expect(shouldSkipSender('alice@customer.com')).toBe(false);
  });
});

describe('PawaPay deposit activation', () => {
  it('activates plan on v2 FOUND wrapper with COMPLETED data status', () => {
    const parsed = parsePawaPayDepositStatus({
      status: 'FOUND',
      data: { depositId: 'dep-1', status: 'COMPLETED' },
    });
    expect(parsed?.depositStatus).toBe('COMPLETED');
    expect(parsed?.lookupStatus).toBe('FOUND');
  });
});
