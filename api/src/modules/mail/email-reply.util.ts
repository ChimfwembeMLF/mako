/** Prepare inbound email text for AI and detect bulk marketing mail. */

export function sanitizeInboundEmailBody(raw: string): string {
  let text = raw.replace(/\r\n/g, '\n');

  // Drop quoted reply chains
  const quoteMarkers = [
    /\nOn .+ wrote:\n[\s\S]*/i,
    /\n-{2,}\s*Original Message\s*-{2,}[\s\S]*/i,
    /\n>{1,}.+/,
    /\nFrom:.+\nSent:.+\nTo:.+\nSubject:[\s\S]*/i,
  ];
  for (const pattern of quoteMarkers) {
    text = text.replace(pattern, '');
  }

  text = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (text.length > 4000) {
    text = `${text.slice(0, 4000)}…`;
  }

  return text;
}

export function isMarketingOrBulkEmail(params: {
  subject?: string;
  body?: string;
  listUnsubscribe?: string;
  autoSubmitted?: boolean;
}): boolean {
  if (params.autoSubmitted) return true;
  if (params.listUnsubscribe?.trim()) return true;

  const combined = `${params.subject ?? ''}\n${params.body ?? ''}`.toLowerCase();
  const marketingSignals = [
    'unsubscribe',
    'manage your preferences',
    'view in browser',
    'email preferences',
    'this email was sent to',
    'you are receiving this email because',
    'no longer wish to receive',
    'promotional email',
    'marketing email',
  ];

  return marketingSignals.some((signal) => combined.includes(signal));
}
