import { signOAuthState, verifyOAuthState } from './oauth-state.util';

describe('OAuth state', () => {
  it('round-trips signed data', () => {
    expect(verifyOAuthState(signOAuthState({ tenantId: 't1' }, 's'), 's')).toEqual({ tenantId: 't1' });
  });

  it('rejects state signed with another secret', () => {
    expect(verifyOAuthState(signOAuthState({ tenantId: 't1' }, 'other'), 's')).toBeNull();
  });

  it('rejects tampered data', () => {
    const [, signature] = signOAuthState({ tenantId: 't1' }, 's').split('.');
    const forged = Buffer.from(JSON.stringify({ tenantId: 't2' })).toString('base64url');
    expect(verifyOAuthState(`${forged}.${signature}`, 's')).toBeNull();
  });

  it('rejects the old unsigned format and junk', () => {
    const unsigned = Buffer.from(JSON.stringify({ tenantId: 't1' })).toString('base64');
    expect(verifyOAuthState(unsigned, 's')).toBeNull();
    expect(verifyOAuthState(undefined, 's')).toBeNull();
    expect(verifyOAuthState('a.b.c', 's')).toBeNull();
  });
});
