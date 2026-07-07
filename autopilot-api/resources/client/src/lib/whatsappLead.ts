/** Extract WhatsApp phone from a lead created via WhatsApp inbox. */
export function whatsappPhoneFromLead(lead: {
  email?: string | null;
  source?: string | null;
}): string | null {
  const email = lead.email?.trim().toLowerCase() ?? '';
  const match = email.match(/^wa\+(\d+)@inbox\.mako$/);
  if (match) return match[1];
  return null;
}

export function isWhatsappLead(lead: { email?: string | null; source?: string | null }): boolean {
  return lead.source === 'whatsapp' || whatsappPhoneFromLead(lead) !== null;
}

export function formatWhatsappPhoneDisplay(digits: string): string {
  if (digits.startsWith('260') && digits.length >= 12) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  return digits.startsWith('+') ? digits : `+${digits}`;
}
