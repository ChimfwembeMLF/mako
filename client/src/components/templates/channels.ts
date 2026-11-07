/** Channel names and colour swatches shared by the template list and editor. */
export const CHANNEL_LABEL: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  twitter: 'X',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  pinterest: 'Pinterest',
  threads: 'Threads',
  whatsapp: 'WhatsApp',
  email: 'Email',
  ad_copy: 'Ad copy',
  content: 'General',
  social: 'Social',
};

export const CHANNEL_SWATCH: Record<string, string> = {
  facebook: 'bg-blue-600',
  instagram: 'bg-pink-500',
  linkedin: 'bg-sky-700',
  twitter: 'bg-neutral-800 dark:bg-neutral-300',
  tiktok: 'bg-neutral-900 dark:bg-neutral-200',
  youtube: 'bg-red-600',
  pinterest: 'bg-red-500',
  threads: 'bg-neutral-700',
  whatsapp: 'bg-emerald-500',
  email: 'bg-amber-500',
  ad_copy: 'bg-violet-500',
  content: 'bg-slate-400',
};

/** What a channel's posts must respect; shown beside the instructions. */
export const CHANNEL_RULES: Record<string, string[]> = {
  facebook: ['Up to 63,206 characters', 'No more than 5 hashtags', 'Hook, then body, then a call to action'],
  linkedin: ['Up to 3,000 characters', 'Professional tone', '3–5 hashtags at the end'],
  instagram: ['Up to 2,200 characters', 'Up to 30 hashtags, placed at the end', 'First line shows before “more”'],
  twitter: ['Strictly 280 characters, including hashtags', '1–2 hashtags at most'],
  whatsapp: ['Conversational', 'No markdown', 'About 300 words at most'],
  email: ['Subject of 60 characters or fewer', 'Preview text of 90 characters or fewer', 'One call to action'],
  ad_copy: ['Headline of 40 characters or fewer', 'Main text of 125 characters or fewer', 'One action verb'],
  youtube: ['First two lines show before “Show more”', 'Up to 5,000 characters', 'Timestamps and links are welcome'],
  tiktok: ['Up to 2,200 characters', 'Short, punchy caption', '3–5 hashtags'],
  content: ['HTML allowed: <p>, <ul>, <li>, <strong>'],
};

export function templateChannel(t: { platforms?: string[] | null; contentType?: string | null }): string {
  return t.platforms?.[0] ?? t.contentType ?? 'content';
}
