/** Platform copy trends and limits for AI adaptation at publish time */
export const PLATFORM_PUBLISH_GUIDE: Record<
  string,
  { maxChars: number; trends: string; format: string }
> = {
  facebook: {
    maxChars: 63206,
    trends:
      'Conversational, community-focused. Short paragraphs. Optional 1-2 emojis. Ask a question to drive comments.',
    format:
      'Plain text with blank lines between paragraphs. No markdown, no asterisks for emphasis. Never append "See more" or "See less".',
  },
  instagram: {
    maxChars: 2200,
    trends:
      'Visual-first caption. Hook in first line. 3-8 relevant hashtags at end. Emojis sparingly. CTA in last line.',
    format:
      'Plain text: hook line, blank line, body, blank line, hashtags on final line. No markdown.',
  },
  linkedin: {
    maxChars: 3000,
    trends:
      'Professional thought-leadership. Short lines with white space. Hook + insight + CTA. Minimal hashtags (0-3).',
    format: 'Plain text, one idea per line. No HTML.',
  },
  twitter: {
    maxChars: 280,
    trends:
      'Punchy, timely. One clear idea. 0-2 hashtags max. No thread unless essential.',
    format: 'Single plain-text post under 280 characters.',
  },
  tiktok: {
    maxChars: 4000,
    trends:
      'Casual, trend-aware caption. Reference the video hook. Gen-Z friendly tone if on-brand.',
    format: 'Short caption + 3-5 trending hashtags.',
  },
  email: {
    maxChars: 10000,
    trends: 'Clear subject line energy. Scannable paragraphs. One primary CTA.',
    format: 'Plain text: opening line, body, sign-off.',
  },
  ad_copy: {
    maxChars: 500,
    trends: 'Benefit-led headline energy. Urgency or social proof. Strong CTA.',
    format: 'Short plain text, 2-4 sentences max.',
  },
};

export function platformPublishGuide(platform: string) {
  return (
    PLATFORM_PUBLISH_GUIDE[platform] ?? {
      maxChars: 2000,
      trends: 'Clear, on-brand marketing copy.',
      format: 'Plain text.',
    }
  );
}
