export type AutoReplyRuleSeed = {
  platform: string;
  name: string;
  triggerKeywords?: string[];
  triggerSentiment?: string;
  responseTemplate?: string;
  aiGenerate: boolean;
  isActive: boolean;
};

/** Starter rules — seeded inactive so tenants can review and enable on Replies. */
export const DEFAULT_AUTO_REPLY_RULE_SEEDS: AutoReplyRuleSeed[] = [
  {
    platform: 'whatsapp',
    name: 'WhatsApp — Greeting',
    triggerKeywords: ['hi', 'hello', 'hey', 'good morning', 'good afternoon'],
    triggerSentiment: 'any',
    aiGenerate: true,
    isActive: false,
  },
  {
    platform: 'whatsapp',
    name: 'WhatsApp — Default AI reply',
    triggerKeywords: [],
    triggerSentiment: 'any',
    aiGenerate: true,
    isActive: false,
  },
  {
    platform: 'facebook',
    name: 'Facebook — Thank you',
    triggerKeywords: ['thanks', 'thank you', 'appreciate'],
    triggerSentiment: 'positive',
    aiGenerate: true,
    isActive: false,
  },
  {
    platform: 'facebook',
    name: 'Facebook — Default comment reply',
    triggerKeywords: [],
    triggerSentiment: 'any',
    aiGenerate: true,
    isActive: false,
  },
  {
    platform: 'instagram',
    name: 'Instagram — Pricing & availability',
    triggerKeywords: ['price', 'cost', 'how much', 'available', 'book'],
    triggerSentiment: 'any',
    aiGenerate: true,
    isActive: false,
  },
  {
    platform: 'instagram',
    name: 'Instagram — Default comment reply',
    triggerKeywords: [],
    triggerSentiment: 'any',
    aiGenerate: true,
    isActive: false,
  },
  {
    platform: 'youtube',
    name: 'YouTube — Question on video',
    triggerKeywords: ['?', 'how', 'what', 'why', 'when', 'where'],
    triggerSentiment: 'any',
    aiGenerate: true,
    isActive: false,
  },
  {
    platform: 'youtube',
    name: 'YouTube — Default comment reply',
    triggerKeywords: [],
    triggerSentiment: 'any',
    aiGenerate: true,
    isActive: false,
  },
  {
    platform: 'linkedin',
    name: 'LinkedIn — Engagement',
    triggerKeywords: ['great', 'insight', 'agree', 'thanks for sharing'],
    triggerSentiment: 'positive',
    aiGenerate: true,
    isActive: false,
  },
  {
    platform: 'linkedin',
    name: 'LinkedIn — Default comment reply',
    triggerKeywords: [],
    triggerSentiment: 'any',
    aiGenerate: true,
    isActive: false,
  },
  {
    platform: 'twitter',
    name: 'X — DM greeting',
    triggerKeywords: ['hi', 'hello', 'hey', 'dm', 'question'],
    triggerSentiment: 'any',
    aiGenerate: true,
    isActive: false,
  },
  {
    platform: 'twitter',
    name: 'X — Default DM reply',
    triggerKeywords: [],
    triggerSentiment: 'any',
    aiGenerate: true,
    isActive: false,
  },
  {
    platform: 'email',
    name: 'Email — Pricing & support',
    triggerKeywords: ['price', 'cost', 'quote', 'support', 'help', 'question'],
    triggerSentiment: 'any',
    aiGenerate: true,
    isActive: false,
  },
  {
    platform: 'email',
    name: 'Email — Default auto-reply',
    triggerKeywords: [],
    triggerSentiment: 'any',
    aiGenerate: true,
    isActive: false,
  },
];
