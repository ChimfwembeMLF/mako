import { maskNumber, normalizeZambianNumber } from './sms-number.util';

describe('normalizeZambianNumber', () => {
  it.each([
    ['0971234567', '260971234567'],
    ['971234567', '260971234567'],
    ['+260971234567', '260971234567'],
    ['260971234567', '260971234567'],
    ['+260 97 123 4567', '260971234567'],
    ['097-123-4567', '260971234567'],
    ['(097) 1234567', '260971234567'],
    ['0761234567', '260761234567'],
  ])('reads %s', (input, expected) => {
    expect(normalizeZambianNumber(input)).toBe(expected);
  });

  it.each(['', 'abc', '097123', '09712345678', '+27821234567', '14155550123', '0211234567'])(
    'rejects %s',
    (input) => {
      expect(normalizeZambianNumber(input)).toBeNull();
    },
  );
});

describe('maskNumber', () => {
  it('keeps only the last three digits', () => {
    expect(maskNumber('260971234567')).toBe('***567');
  });
});
