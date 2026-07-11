import { Injectable } from '@nestjs/common';
import { BrandProfiles } from '../../brand_profiles/entities/brand_profiles.entity';
import { ContentTemplates } from '../../templates/entities/content_templates.entity';
import { BrandContext, brandContextBlock } from '../prompts/brand-fields';

@Injectable()
export class PromptBuilderService {
  brandFromEntity(profile: BrandProfiles | null): BrandContext {
    if (!profile) return {};
    return {
      brandType: profile.brandType,
      companyName: profile.companyName,
      industry: profile.industry,
      description: profile.description,
      services: profile.services,
      targetAudience: profile.targetAudience,
      audiencePainPoints: profile.audiencePainPoints,
      toneOfVoice: profile.toneOfVoice,
      brandPersonality: profile.brandPersonality,
      currentOffers: profile.currentOffers,
      uniqueSellingPoints: profile.uniqueSellingPoints,
      faqs: profile.faqs,
      caseStudies: profile.caseStudies,
      bannedWords: profile.bannedWords,
      bannedTopics: profile.bannedTopics,
      competitors: profile.competitors,
      keywords: profile.keywords,
    };
  }

  contentGenerationSystem(
    brand: BrandContext,
    platform?: string,
    template?: ContentTemplates | null,
  ): string {
    const guardrails = [
      brand.bannedWords ? `Never use these words: ${brand.bannedWords}` : '',
      brand.bannedTopics ? `Avoid these topics: ${brand.bannedTopics}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const templateBlock = template?.body?.trim()
      ? `\nContent template "${template.name}":\n${template.body.trim()}\n`
      : '';

    const outputFormat =
      template?.contentType === 'social' || platform
        ? 'Return ONLY valid JSON: {"title":"...","content":"plain text post body"}'
        : 'Return ONLY valid JSON: {"title":"...","content":"<p>HTML paragraphs</p>"}\nUse simple HTML (<p>, <ul>, <li>, <strong>) — no scripts or external links.';

    const entityDescriptor = brand.brandType === 'professional_resume' ? 'this professional' : (brand.brandType === 'product' ? 'this product' : 'this brand');
    const roleDescriptor = brand.brandType === 'professional_resume' ? 'professional content writer' : 'marketing copywriter';

    return `You are a ${roleDescriptor} for ${
      brand.companyName || entityDescriptor
    }.
Write on-brand content using the profile below.
${platform ? `Optimize for ${platform}.` : 'Write versatile marketing copy.'}
${templateBlock}${guardrails}
${outputFormat}`;
  }

  contentGenerationUser(
    brand: BrandContext,
    theme: string,
    draft?: string,
    contentType?: string,
    tractionInsights?: string,
  ): string {
    const parts = [
      `Brand profile:\n${brandContextBlock(brand)}`,
      `Campaign theme: ${theme}`,
    ];
    if (tractionInsights?.trim()) parts.push(tractionInsights.trim());
    if (contentType) parts.push(`Content type: ${contentType}`);
    if (draft?.trim()) parts.push(`Existing draft to improve:\n${draft}`);
    return parts.join('\n\n');
  }

  repurposeSystem(brand: BrandContext, targetPlatform: string): string {
    return `Adapt marketing content for ${targetPlatform} while staying on-brand.
${brandContextBlock(brand)}
Return ONLY valid JSON: {"title":"...","content":"<p>HTML</p>"}`;
  }

  platformAdaptSystem(
    brand: BrandContext,
    platform: string,
    guide: { maxChars: number; trends: string; format: string },
    template?: ContentTemplates | null,
  ): string {
    const guardrails = [
      brand.bannedWords ? `Never use: ${brand.bannedWords}` : '',
      brand.bannedTopics ? `Avoid topics: ${brand.bannedTopics}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const templateBlock = template?.body?.trim()
      ? `\nTenant content template "${
          template.name
        }":\n${template.body.trim()}\n`
      : '';

    const entityDescriptor = brand.brandType === 'professional_resume' ? 'this professional' : (brand.brandType === 'product' ? 'this product' : 'this brand');

    return `You are an expert ${platform} content strategist for ${
      brand.companyName || entityDescriptor
    }.
${brandContextBlock(brand)}

Platform: ${platform}
Character limit: ${guide.maxChars}
Current trends: ${guide.trends}
Format: ${guide.format}
${templateBlock}${guardrails}

Return ONLY valid JSON: {"title":"short headline","content":"plain text post body"}
Rules:
- Match how top creators/brands post on ${platform} TODAY (tone, length, hooks, hashtags if appropriate).
- content must be plain text (no HTML, no markdown).
- Stay within ${guide.maxChars} characters for content.
- Do NOT mention other platforms.`;
  }

  platformAdaptBatchSystem(
    brand: BrandContext,
    platforms: Array<{
      platform: string;
      guide: { maxChars: number; trends: string; format: string };
    }>,
  ): string {
    const guardrails = [
      brand.bannedWords ? `Never use: ${brand.bannedWords}` : '',
      brand.bannedTopics ? `Avoid topics: ${brand.bannedTopics}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const blocks = platforms
      .map(
        (p) =>
          `"${p.platform}": max ${p.guide.maxChars} chars | trends: ${p.guide.trends} | format: ${p.guide.format}`,
      )
      .join('\n');

    const keys = platforms.map((p) => `"${p.platform}"`).join(', ');

    const entityDescriptor = brand.brandType === 'professional_resume' ? 'this professional' : (brand.brandType === 'product' ? 'this product' : 'this brand');

    return `You are a multi-platform social content strategist for ${
      brand.companyName || entityDescriptor
    }.
${brandContextBlock(brand)}

Adapt ONE source post into SEPARATE, platform-native versions. Each platform version MUST be meaningfully different:
- different hooks, length, tone, structure, and hashtags (where appropriate)
- NEVER copy-paste the same text across platforms

Platform rules:
${blocks}
${guardrails}

Return ONLY valid JSON — one top-level key per platform (${keys}).
Each value: {"title":"short headline","content":"plain text post body"}
Global rules:
- content must be plain text (no HTML, no markdown)
- respect each platform's character limit
- do NOT mention other platforms inside any post`;
  }

  platformAdaptDistinctRetry(
    brand: BrandContext,
    platform: string,
    guide: { maxChars: number; trends: string; format: string },
    otherPlatformSummaries: string,
  ): string {
    return `${this.platformAdaptSystem(brand, platform, guide)}

IMPORTANT: Your version must be clearly different from these other platform versions already written:
${otherPlatformSummaries}

Rewrite with a fresh hook and structure — do not reuse sentences from the above.`;
  }

  replySystem(brand: BrandContext): string {
    return `Write a short, friendly social media reply on-brand.
${brandContextBlock(brand)}
Return ONLY valid JSON: {"content":"plain text reply under 280 chars"}`;
  }

  commentReplySystem(brand: BrandContext, platform: string): string {
    const guardrails = [
      brand.bannedWords ? `Never use these words: ${brand.bannedWords}` : '',
      brand.bannedTopics ? `Avoid these topics: ${brand.bannedTopics}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const entityDescriptor = brand.brandType === 'professional_resume' ? 'this professional' : (brand.brandType === 'product' ? 'this product' : 'this brand');

    return `You write public ${platform} comment replies for ${
      brand.companyName || entityDescriptor
    }.
${brandContextBlock(brand)}
${guardrails}

Rules:
- Reply directly to what the commenter said — acknowledge their point or question first.
- Stay consistent with the original post's topic and tone.
- Match ${platform} comment style (concise, conversational; hashtags only if natural on that platform).
- No generic filler ("Thanks for reaching out!") unless it fits the comment.
- Do not invent offers, prices, or policies not supported by the brand profile or post.
- Plain text only — no HTML, markdown, or JSON in the reply body.

Return ONLY valid JSON: {"content":"plain text reply under 500 chars"}`;
  }

  commentReplyUser(params: {
    platform: string;
    postTitle?: string;
    postContent: string;
    commenterName: string;
    commentText: string;
  }): string {
    const postBlock = [
      params.postTitle ? `Title: ${params.postTitle}` : '',
      `Post:\n${params.postContent.replace(/<[^>]*>/g, '').trim()}`,
    ]
      .filter(Boolean)
      .join('\n');

    return [
      `Platform: ${params.platform}`,
      `Original published content:\n${postBlock}`,
      `Comment from ${params.commenterName}:\n${params.commentText}`,
      'Write one reply that addresses their comment in context of the post.',
    ].join('\n\n');
  }
}
