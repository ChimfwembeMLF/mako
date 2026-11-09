import { isGsm7, SMS_MESSAGES, SmsMessageKey } from './sms-messages';

const SAMPLE_CODE = '123456';
const all = (Object.keys(SMS_MESSAGES) as SmsMessageKey[]).map((key) => ({
  key,
  text: (SMS_MESSAGES[key] as (code: string) => string)(SAMPLE_CODE),
}));

describe('SMS_MESSAGES', () => {
  it.each(all)('$key fits in one SMS', ({ text }) => {
    expect(text.length).toBeLessThanOrEqual(160);
  });

  it.each(all)('$key uses only standard SMS characters', ({ text }) => {
    expect(isGsm7(text)).toBe(true);
  });

  it.each(all)('$key says who it is from', ({ text }) => {
    expect(text.startsWith('Mako: ')).toBe(true);
  });

  it.each(all)('$key carries no link', ({ text }) => {
    expect(text).not.toMatch(/https?:\/\//);
  });

  it('puts the code in the codes', () => {
    expect(SMS_MESSAGES.verifyPhone('987654')).toContain('987654');
    expect(SMS_MESSAGES.resetPassword('987654')).toContain('987654');
  });

  it('spots characters that would split a text', () => {
    expect(isGsm7("Don't")).toBe(true);
    expect(isGsm7('Don’t')).toBe(false);
    expect(isGsm7('Mako — hi')).toBe(false);
  });
});
