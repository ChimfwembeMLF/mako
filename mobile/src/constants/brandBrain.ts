export type BrandData = {
  brandType: string;
  companyName: string;
  industry: string;
  description: string;
  services: string;
  targetAudience: string;
  audiencePainPoints: string;
  toneOfVoice: string;
  brandPersonality: string;
  currentOffers: string;
  uniqueSellingPoints: string;
  faqs: string;
  caseStudies: string;
  bannedWords: string;
  bannedTopics: string;
  competitors: string;
  keywords: string;
  websiteUrl: string;
};

export type BrandFieldDef = {
  key: keyof BrandData;
  label: string;
  multiline?: boolean;
  placeholder?: string;
  ai?: boolean;
};

export const BRAND_TYPE_OPTIONS = [
  { id: 'business', label: 'Business' },
  { id: 'product', label: 'Product' },
  { id: 'professional_resume', label: 'Professional' },
] as const;

export const initialBrandData: BrandData = {
  brandType: 'business',
  companyName: '',
  industry: '',
  description: '',
  services: '',
  targetAudience: '',
  audiencePainPoints: '',
  toneOfVoice: '',
  brandPersonality: '',
  currentOffers: '',
  uniqueSellingPoints: '',
  faqs: '',
  caseStudies: '',
  bannedWords: '',
  bannedTopics: '',
  competitors: '',
  keywords: '',
  websiteUrl: '',
};

export const BRAND_BRAIN_SECTIONS: Array<{
  id: string;
  label: string;
  fields: BrandFieldDef[];
}> = [
  {
    id: 'company',
    label: 'Company',
    fields: [
      { key: 'companyName', label: 'Company name', placeholder: 'Acme Inc.', ai: true },
      { key: 'industry', label: 'Industry', placeholder: 'SaaS, E-commerce…', ai: true },
      {
        key: 'description',
        label: 'Company description',
        multiline: true,
        placeholder: 'What does your company do?',
        ai: true,
      },
      {
        key: 'services',
        label: 'Products & services',
        multiline: true,
        placeholder: 'Main products and services',
        ai: true,
      },
      {
        key: 'uniqueSellingPoints',
        label: 'Unique selling points',
        multiline: true,
        placeholder: 'What makes you different?',
        ai: true,
      },
    ],
  },
  {
    id: 'audience',
    label: 'Audience',
    fields: [
      {
        key: 'targetAudience',
        label: 'Target audience',
        multiline: true,
        placeholder: 'Demographics, job titles, interests…',
        ai: true,
      },
      {
        key: 'audiencePainPoints',
        label: 'Pain points',
        multiline: true,
        placeholder: 'Problems your audience faces',
        ai: true,
      },
      {
        key: 'competitors',
        label: 'Competitors',
        multiline: true,
        placeholder: 'Main competitors',
        ai: true,
      },
    ],
  },
  {
    id: 'voice',
    label: 'Voice',
    fields: [
      {
        key: 'toneOfVoice',
        label: 'Tone of voice',
        multiline: true,
        placeholder: 'Professional, casual, witty…',
        ai: true,
      },
      {
        key: 'brandPersonality',
        label: 'Brand personality',
        multiline: true,
        placeholder: 'If your brand were a person…',
        ai: true,
      },
      {
        key: 'keywords',
        label: 'Key phrases & keywords',
        multiline: true,
        placeholder: 'Phrases to use often',
        ai: true,
      },
    ],
  },
  {
    id: 'offers',
    label: 'Offers',
    fields: [
      {
        key: 'currentOffers',
        label: 'Current offers',
        multiline: true,
        placeholder: 'Active promotions, deals…',
        ai: true,
      },
      { key: 'faqs', label: 'FAQs', multiline: true, placeholder: 'Common Q&A', ai: true },
      {
        key: 'caseStudies',
        label: 'Case studies',
        multiline: true,
        placeholder: 'Success stories, client wins…',
        ai: true,
      },
    ],
  },
  {
    id: 'guardrails',
    label: 'Guardrails',
    fields: [
      {
        key: 'bannedWords',
        label: 'Banned words',
        multiline: true,
        placeholder: 'Words the AI should never use',
        ai: false,
      },
      {
        key: 'bannedTopics',
        label: 'Banned topics',
        multiline: true,
        placeholder: 'Topics to avoid in all content',
        ai: false,
      },
    ],
  },
];

const TRACKED_KEYS: (keyof BrandData)[] = [
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
];

export function brandDataFromApi(row: Record<string, unknown> | null | undefined): BrandData {
  if (!row) return { ...initialBrandData };
  return {
    brandType: String(row.brandType || 'business'),
    companyName: String(row.companyName ?? ''),
    industry: String(row.industry ?? ''),
    description: String(row.description ?? ''),
    services: String(row.services ?? ''),
    targetAudience: String(row.targetAudience ?? ''),
    audiencePainPoints: String(row.audiencePainPoints ?? ''),
    toneOfVoice: String(row.toneOfVoice ?? ''),
    brandPersonality: String(row.brandPersonality ?? ''),
    currentOffers: String(row.currentOffers ?? ''),
    uniqueSellingPoints: String(row.uniqueSellingPoints ?? ''),
    faqs: String(row.faqs ?? ''),
    caseStudies: String(row.caseStudies ?? ''),
    bannedWords: String(row.bannedWords ?? ''),
    bannedTopics: String(row.bannedTopics ?? ''),
    competitors: String(row.competitors ?? ''),
    keywords: String(row.keywords ?? ''),
    websiteUrl: String(row.websiteUrl ?? ''),
  };
}

export function brandDataToApi(data: BrandData) {
  return {
    brandType: data.brandType,
    companyName: data.companyName,
    industry: data.industry,
    description: data.description,
    services: data.services,
    targetAudience: data.targetAudience,
    audiencePainPoints: data.audiencePainPoints,
    toneOfVoice: data.toneOfVoice,
    brandPersonality: data.brandPersonality,
    currentOffers: data.currentOffers,
    uniqueSellingPoints: data.uniqueSellingPoints,
    faqs: data.faqs,
    caseStudies: data.caseStudies,
    bannedWords: data.bannedWords,
    bannedTopics: data.bannedTopics,
    competitors: data.competitors,
    keywords: data.keywords,
    websiteUrl: data.websiteUrl,
  };
}

export function brandProfileCompletion(data: BrandData): number {
  const filled = TRACKED_KEYS.filter((key) => data[key]?.trim()).length;
  return Math.round((filled / TRACKED_KEYS.length) * 100);
}
