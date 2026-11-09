/**
 * Every text message Mako sends on its own behalf, in one place.
 *
 * Rules (checked in sms-messages.spec.ts):
 * - Start with "Mako:" so people know who it's from.
 * - Fit in one SMS: 160 characters, using only the standard GSM-7 characters. One
 *   curly quote or long dash switches the whole text to UCS-2, where one SMS holds
 *   only 70 characters and costs more.
 * - Never include a link that signs someone in.
 */
export const SMS_MESSAGES = {
  verifyPhone: (code: string) =>
    `Mako: Your verification code is ${code}. It expires in 10 minutes. Never share this code with anyone.`,
  resetPassword: (code: string) =>
    `Mako: Your password reset code is ${code}. It expires in 10 minutes. If you didn't ask for it, ignore this text.`,
  passwordChanged: () =>
    "Mako: Your password was just changed. If this wasn't you, reset it now from the sign-in page and contact Mako support.",
} as const;

export type SmsMessageKey = keyof typeof SMS_MESSAGES;

/** The standard GSM 03.38 alphabet (basic set plus the common extension characters). */
const GSM7 =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà^{}\\[~]|€';

export function isGsm7(text: string): boolean {
  return [...text].every((ch) => GSM7.includes(ch));
}
