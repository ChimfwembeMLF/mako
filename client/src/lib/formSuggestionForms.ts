export type FormSuggestionForm = 'brand-brain' | 'content' | 'campaign' | 'whatsapp-menu';

export const FORM_SUGGESTION_FIELDS: Record<FormSuggestionForm, string[]> = {
  'brand-brain': [
    'companyName',
    'industry',
    'description',
    'services',
    'targetAudience',
    'audiencePainPoints',
    'toneOfVoice',
    'brandPersonality',
    'currentOffers',
    'uniqueSellingPoints',
    'faqs',
    'caseStudies',
    'competitors',
    'keywords',
  ],
  content: ['theme', 'title'],
  campaign: ['name', 'theme', 'goal'],
  'whatsapp-menu': [
    'serviceName',
    'welcomeMessage',
    'menuTitle',
    'menuDescription',
    'menuResponse',
  ],
};

export const CACHE_TTL_MS = 30 * 60 * 1000;
export const ROTATION_INTERVAL_MS = 4000;
export const CACHE_VERSION = 'v4';
