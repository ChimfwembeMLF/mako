export type TemplateSeed = {
  name: string;
  description: string;
  contentType: string;
  platforms: string[];
  body: string;
};

export const DEFAULT_CONTENT_TEMPLATE_SEEDS: TemplateSeed[] = [
  {
    name: 'Facebook — Community Post',
    description: 'Conversational feed post with hook, story, and comment-driving CTA.',
    contentType: 'social',
    platforms: ['facebook'],
    body: `Write for Facebook feed.
Structure: hook (1 line) → short story or insight (2-3 short paragraphs) → question or CTA to drive comments.
Tone: conversational, warm, community-focused. 1-2 emojis max if on-brand.
Length: 150-400 words. Line breaks between paragraphs.
End with a question when appropriate. No markdown. Max 5 hashtags if used.`,
  },
  {
    name: 'LinkedIn — Thought Leadership',
    description: 'Professional post with white-space formatting and insight-led hook.',
    contentType: 'social',
    platforms: ['linkedin'],
    body: `Write for LinkedIn.
Structure: bold hook line → personal insight or lesson → 3-5 short single-line points → clear CTA.
Tone: professional, credible, human — not corporate jargon.
Use line breaks generously (one idea per line). 0-3 relevant hashtags at the end.
Length: 800-1,500 characters. No HTML or markdown.`,
  },
  {
    name: 'Instagram — Caption',
    description: 'Visual-first caption with hook line and hashtag block.',
    contentType: 'social',
    platforms: ['instagram'],
    body: `Write an Instagram caption.
First line must hook before "see more". Describe the visual or moment vividly.
Body: 2-4 short lines with personality. CTA in the last line (save, share, link in bio).
End with 5-10 relevant hashtags on a separate final line.
Length: under 2,200 characters. Emojis sparingly if on-brand.`,
  },
  {
    name: 'X / Twitter — Single Post',
    description: 'Punchy single-tweet copy under 280 characters.',
    contentType: 'social',
    platforms: ['twitter'],
    body: `Write a single X/Twitter post.
STRICT 280 character limit including spaces and hashtags.
One clear idea. Punchy hook. 0-2 hashtags max.
No thread. No markdown. Plain text only.`,
  },
  {
    name: 'WhatsApp — Broadcast',
    description: 'Human, conversational broadcast message.',
    contentType: 'messaging',
    platforms: ['whatsapp'],
    body: `Write a WhatsApp broadcast message.
Tone: personal and conversational — like texting a contact, not a mass blast.
No markdown, no bullet symbols. Short paragraphs.
Max ~300 words. One clear next step. Avoid spammy urgency.`,
  },
  {
    name: 'Email — Marketing',
    description: 'Scannable marketing email with subject-line energy.',
    contentType: 'email',
    platforms: ['email'],
    body: `Write marketing email body copy.
Opening: strong subject-line energy in the first sentence.
Body: scannable short paragraphs, one primary CTA.
Sign-off: warm and on-brand. Avoid spam trigger words (FREE!!!, act now).
Suggest a subject line ≤ 60 chars and preheader ≤ 90 chars in the title field.`,
  },
  {
    name: 'Ad Copy — Paid Social',
    description: 'Benefit-led short ad with urgency and single CTA.',
    contentType: 'ad_copy',
    platforms: ['ad_copy'],
    body: `Write paid social ad copy.
Lead with pain point or benefit. Add social proof or urgency if on-brand.
Headline energy ≤ 40 chars in title. Primary text ≤ 125 chars in content.
One strong CTA verb (Start, Get, Book, Try). 2-4 sentences max.`,
  },
  {
    name: 'General — Blog / Article',
    description: 'Versatile long-form HTML content for websites and newsletters.',
    contentType: 'content',
    platforms: ['content'],
    body: `Write versatile marketing content as HTML.
Use <p>, <ul>, <li>, <strong> only — no scripts or external links.
Structure: compelling title → intro paragraph → 2-4 sections with subheads as <strong> → conclusion with CTA.
Tone: on-brand, helpful, authoritative. 400-800 words.`,
  },
];
