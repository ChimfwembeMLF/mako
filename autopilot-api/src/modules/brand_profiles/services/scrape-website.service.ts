import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { MistralChatService } from '../../ai/services/mistral-chat.service';
import { AiUsageTrackerService } from '../../ai/services/ai-usage-tracker.service';
import {
  brandExtractionSystemPrompt,
  normalizeBrandExtraction,
} from '../../ai/prompts/brand-fields';

@Injectable()
export class ScrapeWebsiteService {
  private readonly logger = new Logger(ScrapeWebsiteService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly mistral: MistralChatService,
    private readonly usage: AiUsageTrackerService,
  ) {}

  async scrape(params: {
    url: string;
    tenantId: string;
    userId: string;
  }): Promise<Partial<Record<string, string>> & { websiteUrl?: string }> {
    await this.usage.assertWithinLimit(params.tenantId, params.userId);

    const normalized = this.normalizeUrl(params.url);
    const timeout = parseInt(
      this.config.get<string>('SCRAPE_TIMEOUT_MS') || '15000',
      10,
    );
    const maxPages = parseInt(
      this.config.get<string>('SCRAPE_MAX_PAGES') || '3',
      10,
    );

    const pages = await this.fetchPages(normalized, maxPages, timeout);
    const combined = pages.join('\n\n---\n\n').slice(0, 24000);

    if (!combined.trim()) {
      throw new BadRequestException('Could not extract text from the website');
    }

    const { data, tokensUsed } = await this.mistral.completeJson<
      Record<string, unknown>
    >(
      [
        { role: 'system', content: brandExtractionSystemPrompt() },
        {
          role: 'user',
          content: `Website URL: ${normalized}\n\nExtract a complete brand profile from this content. Fill every JSON key.\n\nPage content:\n${combined}`,
        },
      ],
      { model: this.mistral.premiumModel },
    );

    await this.usage.record({
      tenantId: params.tenantId,
      userId: params.userId,
      functionName: 'scrape-brand',
      tokensUsed,
    });

    const result = normalizeBrandExtraction(data);
    return { ...result, websiteUrl: normalized };
  }

  private normalizeUrl(url: string): string {
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
    return trimmed;
  }

  private async fetchPages(
    baseUrl: string,
    maxPages: number,
    timeout: number,
  ): Promise<string[]> {
    const texts: string[] = [];
    const visited = new Set<string>();
    const origin = new URL(baseUrl).origin;
    const queue: string[] = [
      baseUrl,
      ...[
        '/about',
        '/about-us',
        '/company',
        '/services',
        '/products',
        '/solutions',
        '/faq',
        '/contact',
      ].map((path) => `${origin}${path}`),
    ];

    while (queue.length && texts.length < maxPages) {
      const url = queue.shift()!;
      if (visited.has(url)) continue;
      visited.add(url);

      try {
        const { data: html } = await axios.get<string>(url, {
          timeout,
          headers: {
            'User-Agent':
              'AutoPilotBot/1.0 (+https://brandpilot.app; brand onboarding)',
            Accept: 'text/html',
          },
          maxRedirects: 3,
        });

        const $ = cheerio.load(html);
        $('script, style, nav, footer, noscript, iframe').remove();
        const title = $('title').text().trim();
        const body = $('main, article, [role=main], .content, #content, body')
          .first()
          .text()
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 12000);

        if (body) texts.push(`URL: ${url}\nTitle: ${title}\n${body}`);

        if (texts.length < maxPages) {
          const origin = new URL(url).origin;
          $('a[href]').each((_, el) => {
            const href = $(el).attr('href');
            if (!href) return;
            try {
              const abs = new URL(href, url).href;
              if (!abs.startsWith(origin)) return;
              if (/\.(pdf|jpg|png|zip)$/i.test(abs)) return;
              if (/(\/about|\/services|\/products|\/company)/i.test(abs)) {
                queue.push(abs);
              }
            } catch {
              /* ignore bad URLs */
            }
          });
        }
      } catch (err) {
        this.logger.warn(`Scrape failed for ${url}`, err);
        if (!texts.length)
          throw new BadRequestException(`Could not fetch ${url}`);
      }
    }

    return texts;
  }
}
