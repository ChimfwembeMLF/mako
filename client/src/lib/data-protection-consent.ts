export const DATA_PROTECTION_CONSENT_VERSION = '1';
export const DATA_PROTECTION_STORAGE_KEY = 'mako_data_protection_consent';

export type StoredDataProtectionConsent = {
  visitorId: string;
  consentVersion: string;
  acceptedAt: string;
  consentId?: string;
};

function randomVisitorId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `v_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function getOrCreateVisitorId(): string {
  const stored = readStoredConsent();
  if (stored?.visitorId) return stored.visitorId;
  return randomVisitorId();
}

export function readStoredConsent(): StoredDataProtectionConsent | null {
  try {
    const raw = localStorage.getItem(DATA_PROTECTION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDataProtectionConsent;
    if (!parsed?.visitorId || !parsed?.acceptedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hasLocalConsent(version = DATA_PROTECTION_CONSENT_VERSION): boolean {
  const stored = readStoredConsent();
  return stored?.consentVersion === version && Boolean(stored.acceptedAt);
}

export function saveLocalConsent(data: StoredDataProtectionConsent): void {
  localStorage.setItem(DATA_PROTECTION_STORAGE_KEY, JSON.stringify(data));
}
