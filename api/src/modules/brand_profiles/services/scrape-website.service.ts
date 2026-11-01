import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as cheerio from 'cheerio';
import {
  assertPublicUrl,
  publicOnlyRequestOptions,
} from '../../../common/public-http.util';
import { AiProviderRouter } from '../../ai/services/ai-provider-router.service';
import { AiUsageTrackerService } from '../../ai/services/ai-usage-tracker.service';
import {
  brandExtractionSystemPrompt,
  normalizeBrandExtraction,
} from '../../ai/prompts/brand-fields';
import {
  alternateHostUrl,
  buildFetchQueue,
  classifyScrapeError,
  mergeDiscoveredIntoQueue,
  mergeBrandDiscoveryConfig,
  normalizeScrapeUrl,
  rankDiscoveredLinks,
  scrapeFailureMessage,
  type BrandDiscoveryConfig,
  type ScrapeFailureKind,
  ScrapeRateLimiter,
  DiscoveryStatsCollector,
  resolveLogger,
} from '../utils/brand-scrape-paths.util';
import { extractPageText } from '../utils/page-text.util';

/** The seed list is mostly guesses, so a run of misses means stop, not keep trying. */
const MAX_CONSECUTIVE_FAILURES = 10;
const MAX_PAGE_BYTES = 5 * 1024 * 1024;

@Injectable()
export class ScrapeWebsiteService {
  private readonly logger = new Logger(ScrapeWebsiteService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly aiRouter: AiProviderRouter,
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

    const { data, tokensUsed } = await this.aiRouter.completeJson<
      Record<string, unknown>
    >(
      [
        { role: 'system', content: brandExtractionSystemPrompt() },
        {
          role: 'user',
          content: `Website URL: ${normalized}\n\nExtract a complete brand profile from this content. Fill every JSON key.\n\nPage content:\n${combined}`,
        },
      ],
      { model: this.aiRouter.premiumModel,
          tenantId: params.tenantId
    },
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
        'MakoBot/1.0 (+https://mako.tekreminnovations.com; brand onboarding)',
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
    // For scraping a site on your own machine or network during development.
    const allowPrivateHosts =
      this.config.get<string>('SCRAPE_ALLOW_PRIVATE_HOSTS') === 'true';
    let lastFailure: ScrapeFailureKind | null = null;
    let consecutiveFailures = 0;
    let triedAlternateHost = false;
    let reachedSite = false;
    const seenText = new Set<string>();
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
          if (!allowPrivateHosts) assertPublicUrl(canonical);
          const response = await axios.get(canonical, {
            ...(allowPrivateHosts ? {} : publicOnlyRequestOptions),
            maxContentLength: MAX_PAGE_BYTES,
            headers: {
              'User-Agent': discoveryConfig.userAgent,
              Accept: 'text/html,application/xhtml+xml',
            },
            timeout: timeout,
          });
          consecutiveFailures = 0;
          const html = response.data;
          if (typeof html !== 'string') continue;

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

          reachedSite = true;
          const { title, text } = extractPageText(html);
          // App sites can serve the same content at every route.
          if (text && !seenText.has(text)) {
            seenText.add(text);
            texts.push(`URL: ${canonical}\nTitle: ${title}\n${text}`);
          }
        } catch (err) {
          lastFailure = classifyScrapeError(err);
          consecutiveFailures++;
          const message = err instanceof Error ? err.message : String(err);
          stats?.recordError(canonical, message);
          this.logger.warn(
            `Scrape failed for ${canonical} (${lastFailure}): ${message}`,
          );

          if (
            !triedAlternateHost &&
            !texts.length &&
            visited.size === 1 &&
            lastFailure !== 'blocked' &&
            lastFailure !== 'timeout' &&
            lastFailure !== 'non_public'
          ) {
            triedAlternateHost = true;
            const alternate = alternateHostUrl(canonical);
            if (alternate) {
              queue = buildFetchQueue(alternate, discoveryConfig);
              continue;
            }
          }

          // Anything but a page-level miss means more requests won't help, and
          // a site that refused us shouldn't get the rest of the list either.
          if (
            lastFailure !== 'http' ||
            consecutiveFailures >= MAX_CONSECUTIVE_FAILURES
          ) {
            break;
          }
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
        reachedSite
          ? "We reached that website but couldn't find any readable text. It may load its content with JavaScript. Upload a brand document instead, or fill in the fields yourself."
          : lastFailure
          ? scrapeFailureMessage(lastFailure)
          : 'Could not extract text from the website',
      );
    }

    return texts;
  }
}
