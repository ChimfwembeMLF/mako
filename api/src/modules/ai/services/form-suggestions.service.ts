import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MistralChatService } from './mistral-chat.service';
import { PromptBuilderService } from './prompt-builder.service';
import { AiUsageTrackerService } from './ai-usage-tracker.service';
import { BrandProfiles } from '../../brand_profiles/entities/brand_profiles.entity';
import {
  FORM_SUGGESTION_FIELDS,
  FORM_SUGGESTION_FORM_BRIEFS,
  FormSuggestionType,
  INPUT_STYLE_FIELDS,
  MAX_SUGGESTION_LENGTH,
  SUGGESTIONS_PER_FIELD,
  formFieldHint,
  formFieldLabel,
} from '../form-suggestion-forms.constants';
import { brandContextBlock } from '../prompts/brand-fields';

const CREATIVE_TEMPERATURE = 0.88;

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffleWithSeed<T>(items: T[], seed: string): T[] {
  const out = [...items];
  let state = hashSeed(seed || 'default');
  for (let i = out.length - 1; i > 0; i--) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pickVaried<T>(items: T[], count: number, seed: string): T[] {
  if (!items.length) return [];
  return shuffleWithSeed(items, seed).slice(0, count);
}

function variationBlock(seed: string, refresh?: boolean, avoidTexts?: string[]): string {
  const parts = [`Creative variation id: ${seed}. Use it to choose a fresh angle.`];
  if (refresh) {
    parts.push(
      'The user asked for NEW suggestions — do not reuse generic placeholders (e.g. Acme Labs, Tekrem Solutions) or repeat common SaaS clichés.',
    );
  }
  const trimmed = (avoidTexts ?? []).map((t) => t.trim()).filter(Boolean).slice(-5);
  if (trimmed.length) {
    parts.push(
      `Do NOT repeat or closely paraphrase these prior outputs:\n${trimmed.map((t) => `- ${t}`).join('\n')}`,
    );
  }
  return parts.join('\n');
}

const FALLBACK_SUGGESTIONS: Record<string, string[]> = {
  companyName: [
    'Acme Labs',
    'GreenHarvest — farm-to-market delivery',
    'Pulse Digital Studio',
  ],
  industry: ['SaaS', 'Agri-tech & logistics', 'B2B professional services'],
  description: [
    'We help SMEs grow with simple, affordable digital tools.',
    'Founded in 2019, we connect farmers to buyers across Southern Africa — cutting middlemen and raising margins for producers.',
    'Note: lead with outcomes, not features. “Less admin, more revenue.”',
  ],
  services: [
    'Web design, SEO, social media management',
    '- Mobile app development\n- API integrations\n- Monthly retainers\n- Training workshops',
    'End-to-end digital presence: strategy session → build → launch → 90-day optimization.',
  ],
  toneOfVoice: [
    'Friendly, expert, plain English — no jargon',
    'We sound like a smart colleague: confident but never preachy.\nDo: be specific. Don’t: hype or fear-monger.',
    'Warm + direct. Short sentences. Occasional light humor.',
  ],
  targetAudience: [
    'SME owners, 30–50, scaling online for the first time',
    '- Startup founders\n- Ops managers at 10–50 person firms\n- Solo consultants',
    'Marketing leads at B2B SaaS (Series A–B) who need consistent content without hiring.',
  ],
  audiencePainPoints: [
    'No time to post consistently; unclear messaging; low engagement',
    '1. Posting feels random, not strategic\n2. Can’t prove ROI to leadership\n3. Brand voice varies by whoever writes',
    'Comment we hear often: “We know we should be on social — we just never know what to say.”',
  ],
  brandPersonality: [
    'The helpful neighbor who’s also great at spreadsheets',
    '- Curious\n- Practical\n- Optimistic\n- Detail-oriented when it matters',
    'If our brand walked into a room: calm energy, listens first, then offers one clear next step.',
  ],
  currentOffers: [
    '20% off first month — ends Friday',
    '- Free audit call (limited slots)\n- Bundle: setup + 3 months content\n- Refer-a-friend credit',
    'Launch promo: waived onboarding fee for teams signing up before month-end.',
  ],
  uniqueSellingPoints: [
    'Local support, fixed pricing, done-for-you content',
    '- Same-day replies\n- Brand Brain keeps voice consistent\n- Publish to 5 platforms from one place',
    'Unlike generic tools: we learn your brand once, then every post sounds like you.',
  ],
  faqs: [
    'Q: How long setup takes? A: Most teams are live in under a week.',
    'Q: Can I cancel anytime?\nA: Yes — monthly plans, no lock-in.\n\nQ: Do you write in our voice?\nA: Yes, using your Brand Brain profile.',
    '- Pricing? Transparent tiers on our site.\n- Integrations? LinkedIn, Meta, X, and more.\n- Support? Email + in-app chat.',
  ],
  caseStudies: [
    'AgriCo: 3× inbound leads in 60 days after consistent LinkedIn posts',
    'Client: regional retailer. Challenge: stale social presence. Result: 40% engagement lift and 12 demo requests/month.',
    '- FinTech startup: 0 → 2k followers in 90 days\n- Clinic group: filled 30 appointment slots from one campaign',
  ],
  competitors: [
    'Buffer, Hootsuite, local agencies',
    '- Competitor A: strong scheduling, weak AI voice\n- Competitor B: cheap templates, generic output\n- Agencies: high cost, slow turnaround',
    'We compete with DIY tools on price and with agencies on quality — faster than both.',
  ],
  keywords: [
    'brand consistency, content automation, SME marketing',
    '#GrowOnline #BrandVoice #ContentThatConverts\n#SmallBusinessTips #MarketingMadeEasy',
    'Primary: “automated social media for SMEs”\nSecondary: brand brain, multi-platform publishing',
  ],
  serviceName: ['Tekrem Solutions', 'City Clinic', 'Kangwa Digital Studio'],
  welcomeMessage: [
    'Welcome to {serviceName}! How can we help you today?',
    "Hi there 👋 You're chatting with {serviceName}. Pick an option from the menu.",
    '{serviceName} here — reply menu anytime to see what we offer.',
  ],
  menuTitle: [
    'Pricing',
    'Book a call',
    'Store hours',
    'Talk to support',
    'Track my order',
  ],
  menuDescription: [
    'See packages & rates',
    'Schedule with our team',
    'Opening times & location',
    'Chat with a person',
    'Order status updates',
  ],
  menuResponse: [
    'Our starter plan is ZMW 99/month. Pro includes priority support at ZMW 299/month. Reply menu for more options.',
    "Send your preferred date and time — we'll confirm on WhatsApp within 24 hours.",
    'Mon–Fri 8am–6pm, Sat 9am–1pm. Plot 3, Lusaka. Reply menu for other options.',
  ],
};

const FALLBACK_BY_FORM: Partial<
  Record<FormSuggestionType, Record<string, string[]>>
> = {
  campaign: {
    name: [
      'Spring Launch Series',
      'Trust Builder — 7-Day Content Run',
      'Q3 Product Education Campaign',
    ],
    theme: [
      'Launching our new product for SMEs — build awareness, educate on benefits, then drive trial sign-ups over 7 posts',
      '- Post arc: tease the problem\n- Educate on our approach\n- Share customer proof\n- Address objections\n- Limited-time offer + CTA',
      'Re-engage dormant leads with a value-first content series before a seasonal promotion.',
    ],
    goal: [
      'Drive 150 trial sign-ups in 30 days',
      '- Build top-of-funnel awareness\n- Educate on core value prop\n- Generate 40 qualified demo requests',
      'Primary: grow newsletter list by 500. Secondary: lift LinkedIn engagement 25%.',
    ],
  },
  content: {
    theme: [
      'Weekly productivity tip for busy founders',
      '- Product spotlight\n- Customer quote\n- Behind-the-scenes\n- Limited offer',
      'Launch week: announce the feature, share social proof, answer objections, drive sign-ups.',
    ],
    title: [
      '3 reasons teams switch to us',
      'What changed after we shipped v2?',
      'Quick note on pricing (and why it’s worth it)',
    ],
  },
};

@Injectable()
export class FormSuggestionsService {
  constructor(
    private readonly mistral: MistralChatService,
    private readonly prompts: PromptBuilderService,
    private readonly usage: AiUsageTrackerService,
    @InjectRepository(BrandProfiles)
    private readonly brandRepo: Repository<BrandProfiles>,
  ) {}

  async enhanceField(params: {
    tenantId: string;
    workspaceId?: string;
    userId: string;
    form: FormSuggestionType;
    fieldKey: string;
    currentValue?: string;
    variationSeed?: string;
    avoidTexts?: string[];
  }): Promise<{ text: string }> {
    const allowed = FORM_SUGGESTION_FIELDS[params.form];
    if (!allowed.includes(params.fieldKey)) {
      return { text: params.currentValue?.trim() ?? '' };
    }

    await this.usage.assertWithinLimit(params.tenantId, params.userId);

    const brand = params.workspaceId
      ? await this.brandRepo.findOne({
          where: { workspaceId: params.workspaceId, tenantId: params.tenantId },
        }) || await this.brandRepo.findOne({
          where: { tenantId: params.tenantId, userId: params.userId },
        })
      : await this.brandRepo.findOne({
          where: { tenantId: params.tenantId, userId: params.userId },
        });

    const brandCtx = this.prompts.brandFromEntity(brand);
    const label = formFieldLabel(params.form, params.fieldKey);
    const hint = formFieldHint(params.form, params.fieldKey);
    const formBrief = FORM_SUGGESTION_FORM_BRIEFS[params.form];
    const maxLen = INPUT_STYLE_FIELDS.has(params.fieldKey)
      ? MAX_SUGGESTION_LENGTH.input
      : MAX_SUGGESTION_LENGTH.textarea;
    const draft = params.currentValue?.trim() ?? '';
    const isEnhance = draft.length > 0;
    const seed =
      params.variationSeed?.trim() ||
      `${Date.now().toString(36)}-${params.fieldKey}`;

    try {
      const { data, tokensUsed } = await this.mistral.completeJson<{ text?: string }>(
        [
          {
            role: 'system',
            content: `You help users fill marketing form fields.
Return ONLY JSON: { "text": "..." }

Form context: ${formBrief}
Field: ${params.fieldKey} (${label})${hint ? `\nFormat hint: ${hint}` : ''}

${variationBlock(seed, false, params.avoidTexts)}

Rules:
- ${isEnhance ? 'Improve and expand the user\'s draft — clearer, more specific, on-brand. Keep their intent but change wording materially.' : 'Write one strong starter value tailored to the brand — not a generic template.'}
- Plain text only — no markdown headers, code fences, or HTML.
- Use literal newlines for lists or paragraphs when appropriate.
- Maximum ${maxLen} characters.`,
          },
          {
            role: 'user',
            content: [
              brand
                ? `Brand profile:\n${brandContextBlock(brandCtx)}`
                : 'No brand profile yet — use neutral professional examples.',
              isEnhance
                ? `Current draft:\n${draft}`
                : `Generate a starter value for "${label}".`,
            ].join('\n\n'),
          },
        ],
        { model: this.mistral.defaultModel, temperature: CREATIVE_TEMPERATURE },
      );

      await this.usage.record({
        tenantId: params.tenantId,
        userId: params.userId,
        functionName: 'enhance-field',
        tokensUsed,
      });

      const text = this.trimSuggestion(String(data.text ?? ''), maxLen);
      if (text) return { text };
      return {
        text:
          draft ||
          pickVaried(this.fallbackFor(params.form, params.fieldKey, seed), 1, seed)[0]!,
      };
    } catch {
      const options = this.fallbackFor(params.form, params.fieldKey, seed);
      const fallback = pickVaried(options, 1, `${seed}-fb`)[0] ?? '';
      return { text: isEnhance ? draft : fallback };
    }
  }

  async getSuggestions(params: {
    tenantId: string;
    workspaceId?: string;
    userId: string;
    form: FormSuggestionType;
    fields?: string[];
    variationSeed?: string;
    refresh?: boolean;
    avoidTexts?: string[];
  }): Promise<{ suggestions: Record<string, string[]> }> {
    const allowed = FORM_SUGGESTION_FIELDS[params.form];
    const fields = (params.fields?.length ? params.fields : allowed).filter(
      (f) => allowed.includes(f),
    );

    if (!fields.length) {
      return { suggestions: {} };
    }

    await this.usage.assertWithinLimit(params.tenantId, params.userId);

    const brand = params.workspaceId
      ? await this.brandRepo.findOne({
          where: { workspaceId: params.workspaceId, tenantId: params.tenantId },
        }) || await this.brandRepo.findOne({
          where: { tenantId: params.tenantId, userId: params.userId },
        })
      : await this.brandRepo.findOne({
          where: { tenantId: params.tenantId, userId: params.userId },
        });

    const brandCtx = this.prompts.brandFromEntity(brand);

    const fieldList = fields
      .map((f) => {
        const hint = formFieldHint(params.form, f);
        const label = formFieldLabel(params.form, f);
        return hint ? `- ${f} (${label}): ${hint}` : `- ${f}: ${label}`;
      })
      .join('\n');

    const formBrief = FORM_SUGGESTION_FORM_BRIEFS[params.form];
    const seed =
      params.variationSeed?.trim() ||
      `${Date.now().toString(36)}-${params.form}`;

    try {
      const { data, tokensUsed } = await this.mistral.completeJson<{
        suggestions?: Record<string, string[]>;
      }>(
        [
          {
            role: 'system',
            content: `You write varied placeholder suggestions for marketing form fields.
Return ONLY JSON: { "suggestions": { "fieldKey": ["suggestion1", "suggestion2", ...] } }

Form context: ${formBrief}

${variationBlock(seed, params.refresh, params.avoidTexts)}

Rules:
- Exactly ${SUGGESTIONS_PER_FIELD} suggestions per field key.
- Each suggestion must be meaningfully different from the others (different angle, format, length, or example industry).
- Vary LENGTH: include very short (under 40 chars), medium (1–2 sentences), and longer multi-line entries.
- Vary FORMAT across suggestions for the same field:
  • plain descriptions and one-liners
  • bullet lists (prefix lines with "- ")
  • numbered points where natural
  • note-style fragments ("Note:", "Tip:", "Reminder:")
  • comment/reply-style snippets ("We often hear:", "Reply:", "Customers ask:")
  • Q&A pairs for FAQ-style fields
- Use literal newlines inside strings for multi-line suggestions (lists, paragraphs, Q&A).
- No markdown headers, code fences, or HTML.
- Tailor to the brand when a profile exists; otherwise use realistic varied examples (not the same generic names every time).
- Follow each field's format hint. Do not repeat the same structure for all ${SUGGESTIONS_PER_FIELD} suggestions.`,
          },
          {
            role: 'user',
            content: [
              brand
                ? `Brand profile:\n${brandContextBlock(brandCtx)}`
                : 'No brand profile yet — use neutral professional examples.',
              `Form type: ${params.form}`,
              `Fields:\n${fieldList}`,
            ].join('\n\n'),
          },
        ],
        { model: this.mistral.defaultModel, temperature: CREATIVE_TEMPERATURE },
      );

      await this.usage.record({
        tenantId: params.tenantId,
        userId: params.userId,
        functionName: 'form-suggestions',
        tokensUsed,
      });

      return {
        suggestions: this.normalize(params.form, fields, data.suggestions, seed),
      };
    } catch {
      return { suggestions: this.fallbackOnly(params.form, fields, seed) };
    }
  }

  private normalize(
    form: FormSuggestionType,
    fields: string[],
    raw?: Record<string, string[]>,
    seed = 'default',
  ): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const field of fields) {
      const maxLen = INPUT_STYLE_FIELDS.has(field)
        ? MAX_SUGGESTION_LENGTH.input
        : MAX_SUGGESTION_LENGTH.textarea;
      const items = Array.isArray(raw?.[field])
        ? raw![field]
            .map((s) => this.trimSuggestion(String(s), maxLen))
            .filter(Boolean)
            .slice(0, SUGGESTIONS_PER_FIELD)
        : [];

      const fallbacks = this.fallbackFor(form, field, `${seed}-${field}`);
      const merged = [...items];
      for (const fb of shuffleWithSeed(fallbacks, `${seed}-${field}-fill`)) {
        if (merged.length >= SUGGESTIONS_PER_FIELD) break;
        if (!merged.some((m) => m.toLowerCase() === fb.toLowerCase())) {
          merged.push(fb);
        }
      }

      out[field] =
        merged.length >= 2
          ? merged.slice(0, SUGGESTIONS_PER_FIELD)
          : pickVaried(fallbacks, SUGGESTIONS_PER_FIELD, `${seed}-${field}-fb`);
    }
    return out;
  }

  private trimSuggestion(text: string, maxLen: number): string {
    const trimmed = text.trim();
    if (trimmed.length <= maxLen) return trimmed;
    return `${trimmed.slice(0, maxLen - 1).trimEnd()}…`;
  }

  private fallbackOnly(
    form: FormSuggestionType,
    fields: string[],
    seed: string,
  ): Record<string, string[]> {
    return Object.fromEntries(
      fields.map((f) => [
        f,
        pickVaried(this.fallbackFor(form, f, `${seed}-${f}`), SUGGESTIONS_PER_FIELD, `${seed}-${f}`),
      ]),
    );
  }

  private fallbackFor(form: FormSuggestionType, field: string, seed?: string): string[] {
    const formSpecific = FALLBACK_BY_FORM[form]?.[field];
    if (formSpecific?.length) {
      return pickVaried(formSpecific, SUGGESTIONS_PER_FIELD, seed ?? field);
    }
    if (FALLBACK_SUGGESTIONS[field]?.length) {
      return pickVaried(FALLBACK_SUGGESTIONS[field], SUGGESTIONS_PER_FIELD, seed ?? field);
    }
    const label = formFieldLabel(form, field);
    return [
      `Short ${label} example`,
      `- Point one\n- Point two\n- Point three`,
      `Note: a longer ${label} description with a bit more context for the user.`,
    ];
  }
}
