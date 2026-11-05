/**
 * Single source for the legal entity behind Mako.
 *
 * Meta Business Verification compares LEGAL_NAME with the name on the
 * registration certificate and on the website, character for character.
 * Change it only if the registered name changes.
 */
const env = import.meta.env as Record<string, string | undefined>;

export const COMPANY = {
  productName: 'Mako',
  legalName: 'TEKREM INNOVATIONS',
  country: 'Zambia',
  /** Registered business address, exactly as on the verification documents. */
  address: env.VITE_COMPANY_ADDRESS?.trim() || '',
  /** Business phone, exactly as on the verification documents. */
  phone: env.VITE_COMPANY_PHONE?.trim() || '',
  supportEmail: env.VITE_SUPPORT_EMAIL?.trim() || 'tekremsolutions@gmail.com',
} as const;

/** "Mako · TEKREM INNOVATIONS" */
export const COMPANY_BYLINE = `${COMPANY.productName} · ${COMPANY.legalName}`;
