export type FormSuggestionType =
  | 'brand-brain'
  | 'content'
  | 'campaign'
  | 'whatsapp-menu';

export const FORM_SUGGESTION_FIELDS: Record<FormSuggestionType, string[]> = {
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

export const FORM_SUGGESTION_LABELS: Record<string, string> = {
  companyName: 'Company name',
  industry: 'Industry',
  description: 'Company description',
  services: 'Products & services',
  targetAudience: 'Target audience',
  audiencePainPoints: 'Audience pain points',
  toneOfVoice: 'Tone of voice',
  brandPersonality: 'Brand personality',
  currentOffers: 'Current offers',
  uniqueSellingPoints: 'Unique selling points',
  faqs: 'FAQs',
  caseStudies: 'Case studies',
  bannedWords: 'Banned words',
  bannedTopics: 'Banned topics',
  competitors: 'Competitors',
  keywords: 'Keywords & phrases',
  theme: 'Theme',
  title: 'Post title',
  name: 'Name',
  goal: 'Goal',
  serviceName: 'Business / service name',
  welcomeMessage: 'WhatsApp welcome message',
  menuTitle: 'Menu option label',
  menuDescription: 'Menu option short hint',
  menuResponse: 'Reply when customer picks this option',
};

/** Per-form labels when the same field key means something different (e.g. theme). */
export const FORM_SUGGESTION_LABELS_BY_FORM: Partial<
  Record<FormSuggestionType, Partial<Record<string, string>>>
> = {
  content: {
    theme: 'Post theme / topic',
    title: 'Post title',
  },
  campaign: {
    name: 'Campaign name',
    theme: 'Campaign theme (multi-post narrative)',
    goal: 'Campaign goal / KPIs',
  },
};

/** Hints so AI varies format and length per field */
export const FORM_SUGGESTION_FORMAT_HINTS: Record<string, string> = {
  companyName: 'Mix: short name, name + tagline, descriptive brand name',
  industry: 'Mix: 1–3 word label, niche phrase, sector + sub-niche',
  description:
    'Mix: one punchy sentence, 2–3 sentence paragraph, brief mission-style note',
  services:
    'Mix: comma list, bullet list (- item per line), short catalog paragraph',
  targetAudience:
    'Mix: one-line persona, bullet list of segments, demographic + psychographic note',
  audiencePainPoints:
    'Mix: bullet pain points, numbered list, short empathy paragraph',
  toneOfVoice:
    'Mix: adjective list, “We sound like…” note, do/don’t style comment',
  brandPersonality:
    'Mix: metaphor (“If we were a person…”), trait bullets, short character sketch',
  currentOffers: 'Mix: offer headline, bullet promos, urgency note with dates',
  uniqueSellingPoints: 'Mix: 3 bullet USPs, comparison note, proof-point list',
  faqs: 'Mix: Q&A pairs (Q: … A: …), bullet common questions, FAQ snippet with 2 Q&As',
  caseStudies:
    'Mix: client + result one-liner, mini story paragraph, bullet wins',
  competitors:
    'Mix: comma names, bullet list with one-line positioning each, comparison note',
  keywords: 'Mix: comma phrases, hashtag-style list, grouped keyword bullets',
  title: 'Mix: punchy headline, question title, listicle-style (“3 ways to…”)',
  serviceName:
    'Mix: short brand name, name + tagline, descriptive business name',
  welcomeMessage:
    'Mix: friendly one-liner with {serviceName}, question hook, brief “how can we help”',
  menuTitle:
    'Mix: action labels — Pricing, Book demo, Track order, Talk to support',
  menuDescription:
    'Mix: short subtitle under menu label, benefit hint, 3–6 words',
  menuResponse:
    'Mix: factual reply paragraph, bullet facts, hours + contact + next step',
};

/** Per-form hints — overrides shared keys like theme/name/goal */
export const FORM_SUGGESTION_FORMAT_HINTS_BY_FORM: Partial<
  Record<FormSuggestionType, Partial<Record<string, string>>>
> = {
  content: {
    theme:
      'Single social POST topic only. Mix: one-line angle, content pillar, bullet sub-ideas for one post — not a multi-day campaign',
    title:
      'Mix: punchy headline, question title, listicle-style (“3 ways to…”)',
  },
  campaign: {
    name: 'CAMPAIGN series title only. Mix: short codename, seasonal launch name, descriptive multi-post series title — not a post headline',
    theme:
      'CAMPAIGN PLANNING only: overarching narrative for a multi-post series. Mix: 1–2 sentence brief, bullet story arc (tease → educate → proof → CTA), strategic positioning — NOT post hooks, captions, or individual post ideas',
    goal: 'Business/marketing objectives for the whole campaign. Mix: KPI + metric one-liner, bullet objectives, funnel outcome note',
  },
};

/** Extra system instructions per form type */
export const FORM_SUGGESTION_FORM_BRIEFS: Record<FormSuggestionType, string> = {
  'brand-brain':
    'Brand profile setup — suggest realistic values for company identity fields.',
  content:
    'Single social post composer — suggest one post topic and headline. Do not plan multi-post campaigns.',
  campaign:
    'Multi-post campaign planner (name, theme, goal). Suggest campaign-level planning only: series names, overarching narratives, and measurable objectives. Do NOT write post captions, hooks, hashtags, or individual post copy — that happens when the user clicks Generate.',
  'whatsapp-menu':
    'WhatsApp flow menu — suggest business name, welcome text, and menu option labels/replies.',
};

export function formFieldLabel(
  form: FormSuggestionType,
  field: string,
): string {
  return (
    FORM_SUGGESTION_LABELS_BY_FORM[form]?.[field] ??
    FORM_SUGGESTION_LABELS[field] ??
    field
  );
}

export function formFieldHint(
  form: FormSuggestionType,
  field: string,
): string | undefined {
  return (
    FORM_SUGGESTION_FORMAT_HINTS_BY_FORM[form]?.[field] ??
    FORM_SUGGESTION_FORMAT_HINTS[field]
  );
}

export const SUGGESTIONS_PER_FIELD = 4;
export const MAX_SUGGESTION_LENGTH: Record<'input' | 'textarea', number> = {
  input: 160,
  textarea: 600,
};

export const INPUT_STYLE_FIELDS = new Set([
  'companyName',
  'industry',
  'title',
  'name',
  'goal',
  'serviceName',
  'menuTitle',
  'menuDescription',
]);
