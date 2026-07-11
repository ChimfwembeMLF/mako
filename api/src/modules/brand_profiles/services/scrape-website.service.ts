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
import {
  buildFetchQueue,
  mergeDiscoveredIntoQueue,
  mergeBrandDiscoveryConfig,
  normalizeScrapeUrl,
  rankDiscoveredLinks,
  type BrandDiscoveryConfig,
  ScrapeRateLimiter,
  DiscoveryStatsCollector,
  resolveLogger,
} from '../utils/brand-scrape-paths.util';

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
    const discoveryConfig = this.discoveryConfig();
    const timeout = parseInt(
      this.config.get<string>('SCRAPE_TIMEOUT_MS') || '15000',
      10,
    );
    const maxPages = parseInt(
      this.config.get<string>('SCRAPE_MAX_PAGES') || '3',
      10,
    );

    const pages = await this.fetchPages(
      normalized,
      maxPages,
      timeout,
      discoveryConfig,
    );
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

  private discoveryConfig(): BrandDiscoveryConfig {
    return mergeBrandDiscoveryConfig({
      delayBetweenRequests: parseInt(
        this.config.get<string>('SCRAPE_DELAY_MS') || '0',
        10,
      ),
      debug: this.config.get<string>('BRAND_SCRAPE_DEBUG') === 'true',
      stats: this.config.get<string>('BRAND_SCRAPE_STATS') === 'true',
      respectRobotsTxt:
        this.config.get<string>('SCRAPE_RESPECT_ROBOTS') === 'true',
      minScoreForQueue: parseInt(
        this.config.get<string>('BRAND_SCRAPE_MIN_SCORE') || '30',
        10,
      ),
      maxSeedUrls: parseInt(
        this.config.get<string>('BRAND_SCRAPE_MAX_SEEDS') || '120',
        10,
      ),
      userAgent:
        this.config.get<string>('SCRAPE_USER_AGENT') ??
        'MakoBot/1.0 (+https://mako.test; brand onboarding)',
    });
  }

  private normalizeUrl(url: string): string {
    const trimmed = url.trim();
    const withScheme = !/^https?:\/\//i.test(trimmed)
      ? `https://${trimmed}`
      : trimmed;
    return normalizeScrapeUrl(withScheme);
  }

  private async fetchPages(
    baseUrl: string,
    maxPages: number,
    timeout: number,
    discoveryConfig: BrandDiscoveryConfig,
  ): Promise<string[]> {
    const texts: string[] = [];
    const visited = new Set<string>();
    let queue = buildFetchQueue(baseUrl, discoveryConfig);
    let fetchFailures = 0;
    const rateLimiter = new ScrapeRateLimiter(
      discoveryConfig.delayBetweenRequests,
    );
    const stats = discoveryConfig.stats
      ? new DiscoveryStatsCollector()
      : undefined;
    const discoveryLogger = resolveLogger(discoveryConfig);

    try {
      while (queue.length && texts.length < maxPages) {
        const url = queue.shift()!;
        const canonical = normalizeScrapeUrl(url);
        if (visited.has(canonical)) continue;
        visited.add(canonical);
        stats?.recordScanned();

        await rateLimiter.wait();

        try {
          const response = await axios.get(canonical, {
            headers: { 'User-Agent': discoveryConfig.userAgent },
            timeout: timeout,
          });
          const html = response.data;

          const $discover = cheerio.load(html);
          const anchors: Array<{ href: string; text: string }> = [];
          $discover('a[href]').each((_, el) => {
            anchors.push({
              href: $discover(el).attr('href') ?? '',
              text: $discover(el).text(),
            });
          });
          const discovered = rankDiscoveredLinks(
            anchors,
            canonical,
            discoveryConfig,
          );
          for (const link of discovered) {
            stats?.recordRelevant(link.url, link.score);
          }
          discoveryLogger.debug(
            `Discovered ${discovered.length} brand links from ${canonical}`,
          );
          queue = mergeDiscoveredIntoQueue(
            queue,
            discovered,
            visited,
            discoveryConfig,
          );

          const $ = cheerio.load(html);
          $('script, style, nav, footer, noscript, iframe').remove();
          const title = $('title').text().trim();
          const body = $('main, article, [role=main], .content, #content, body')
            .first()
            .text()
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 12000);

          if (body) texts.push(`URL: ${canonical}\nTitle: ${title}\n${body}`);
        } catch (err) {
          fetchFailures++;
          const message = err instanceof Error ? err.message : String(err);
          stats?.recordError(canonical, message);
          this.logger.warn(`Scrape failed for ${canonical}`, err);
        }
      }
    } finally {
      // Cleanup if necessary
    }

    if (stats) {
      discoveryLogger.info(stats.generateReport());
    }

    if (!texts.length) {
      throw new BadRequestException(
        fetchFailures > 0
          ? 'Could not fetch any pages from that website. Try pasting your About or Contact page URL directly.'
          : 'Could not extract text from the website',
      );
    }

    return texts;
  }
}
