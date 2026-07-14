import {
  isPawaPayDepositCompleted,
  parsePawaPayDepositStatus,
} from './pawapay.client';

describe('parsePawaPayDepositStatus', () => {
  it('reads nested v2 status check payloads', () => {
    const parsed = parsePawaPayDepositStatus({
      status: 'FOUND',
      data: {
        depositId: 'dep-1',
        status: 'COMPLETED',
      },
    });

    expect(parsed?.lookupStatus).toBe('FOUND');
    expect(parsed?.depositStatus).toBe('COMPLETED');
    expect(parsed?.depositId).toBe('dep-1');
    expect(isPawaPayDepositCompleted(parsed?.depositStatus)).toBe(true);
  });

  it('reads direct callback payloads', () => {
    const parsed = parsePawaPayDepositStatus({
      depositId: 'dep-2',
      status: 'COMPLETED',
      amount: '100.00',
      currency: 'ZMW',
    });

    expect(parsed?.depositStatus).toBe('COMPLETED');
    expect(parsed?.depositId).toBe('dep-2');
  });

  it('does not treat FOUND as a completed deposit', () => {
    const parsed = parsePawaPayDepositStatus({
      status: 'FOUND',
      data: {
        depositId: 'dep-3',
        status: 'ACCEPTED',
      },
    });

    expect(parsed?.depositStatus).toBe('ACCEPTED');
    expect(isPawaPayDepositCompleted(parsed?.depositStatus)).toBe(false);
  });
});
