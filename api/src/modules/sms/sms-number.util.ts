const ZAMBIAN_MOBILE = /^260[79]\d{8}$/;

/** Trinolux serves Zambia only and expects `260971234567`. Returns null when invalid. */
export function normalizeZambianNumber(input: string): string | null {
  const digits = input.replace(/[\s()+-]/g, '');
  if (!/^\d+$/.test(digits)) return null;

  const full = digits.startsWith('0')
    ? `260${digits.slice(1)}`
    : digits.length === 9
      ? `260${digits}`
      : digits;
  return ZAMBIAN_MOBILE.test(full) ? full : null;
}

/** For logs: enough to tell messages apart, without storing the number. */
export function maskNumber(number: string): string {
  return `***${number.slice(-3)}`;
}
