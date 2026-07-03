/** Logger interface for brand discovery debugging. */
export type BrandDiscoveryLogger = {
  debug: (message: string, data?: unknown) => void;
  info: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  error: (message: string, data?: unknown) => void;
};

/**
 * Configuration for brand page discovery and scraping.
 *
 * @property minScoreForQueue - Minimum score to prepend a discovered URL to the queue
 * @property linkTextBonus - Points added when anchor text matches brand keywords
 * @property depthBonus - Points added for shallow URL paths (depth ≤ 2)
 * @property highScoreThreshold - Score treated as a top-tier about/company page
 * @property aboutScore - Points for English about-page path patterns
 * @property storyScore - Points for who-we-are / our-story patterns
 * @property companyScore - Points for company / mission / vision paths
 * @property servicesScore - Points for services / products paths
 * @property contactScore - Points for contact / FAQ paths
 * @property genericBrandScore - Fallback score when slug matches BRAND_PATH_SLUGS
 * @property maxSeedUrls - Cap on generated seed URLs (performance)
 * @property delayBetweenRequests - Milliseconds to wait between HTTP requests
 * @property respectRobotsTxt - Whether to check robots.txt before fetching
 * @property debug - Enable debug logging
 * @property stats - Collect discovery statistics
 */
export interface BrandDiscoveryConfig {
  minScoreForQueue: number;
  linkTextBonus: number;
  depthBonus: number;
  highScoreThreshold: number;
  aboutScore: number;
  storyScore: number;
  companyScore: number;
  servicesScore: number;
  contactScore: number;
  genericBrandScore: number;
  maxSeedUrls: number;
  maxDepth: number;
  delayBetweenRequests: number;
  maxRetries: number;
  retryDelay: number;
  respectRobotsTxt: boolean;
  debug: boolean;
  stats: boolean;
  userAgent: string;
  logger?: BrandDiscoveryLogger;
}

export const DEFAULT_BRAND_DISCOVERY_CONFIG: BrandDiscoveryConfig = {
  minScoreForQueue: 30,
  linkTextBonus: 35,
  depthBonus: 10,
  highScoreThreshold: 100,
  aboutScore: 100,
  storyScore: 95,
  companyScore: 80,
  servicesScore: 60,
  contactScore: 40,
  genericBrandScore: 50,
  maxSeedUrls: 120,
  maxDepth: 5,
  delayBetweenRequests: 0,
  maxRetries: 0,
  retryDelay: 1000,
  respectRobotsTxt: false,
  debug: false,
  stats: false,
  userAgent: 'AutoPilotBot/1.0 (+https://brandpilot.app; brand onboarding)',
};

export function mergeBrandDiscoveryConfig(
  partial: Partial<BrandDiscoveryConfig> = {},
): BrandDiscoveryConfig {
  return { ...DEFAULT_BRAND_DISCOVERY_CONFIG, ...partial };
}

export class DebugBrandDiscoveryLogger implements BrandDiscoveryLogger {
  constructor(
    private readonly enabled: boolean,
    private readonly prefix = '[BrandDiscovery]',
  ) {}

  debug(message: string, data?: unknown): void {
    if (this.enabled) {
      // eslint-disable-next-line no-console
      console.debug(`${this.prefix} ${message}`, data ?? '');
    }
  }

  info(message: string, data?: unknown): void {
    // eslint-disable-next-line no-console
    console.info(`${this.prefix} ${message}`, data ?? '');
  }

  warn(message: string, data?: unknown): void {
    // eslint-disable-next-line no-console
    console.warn(`${this.prefix} ${message}`, data ?? '');
  }

  error(message: string, data?: unknown): void {
    // eslint-disable-next-line no-console
    console.error(`${this.prefix} ${message}`, data ?? '');
  }
}

export const noopBrandDiscoveryLogger: BrandDiscoveryLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

export function resolveLogger(
  config: BrandDiscoveryConfig,
): BrandDiscoveryLogger {
  if (config.logger) return config.logger;
  if (config.debug) return new DebugBrandDiscoveryLogger(true);
  return noopBrandDiscoveryLogger;
}

/** Simple delay-based rate limiter between scrape requests. */
export class ScrapeRateLimiter {
  private lastRequest = 0;

  constructor(private readonly minDelayMs: number) {}

  async wait(): Promise<void> {
    if (this.minDelayMs <= 0) return;
    const elapsed = Date.now() - this.lastRequest;
    if (elapsed < this.minDelayMs) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.minDelayMs - elapsed),
      );
    }
    this.lastRequest = Date.now();
  }
}

export type DiscoveredLink = { url: string; score: number };

export type DiscoveryStats = {
  totalUrlsScanned: number;
  totalRelevantUrls: number;
  totalSkippedUrls: number;
  averageScore: number;
  highValueUrls: DiscoveredLink[];
  processingTimeMs: number;
  errors: Array<{ url: string; error: string }>;
};

export class DiscoveryStatsCollector {
  private readonly startTime = Date.now();
  private totalUrlsScanned = 0;
  private totalRelevantUrls = 0;
  private totalSkippedUrls = 0;
  private scoreSum = 0;
  private readonly highValueUrls: DiscoveredLink[] = [];
  private readonly errors: Array<{ url: string; error: string }> = [];

  recordScanned(): void {
    this.totalUrlsScanned++;
  }

  recordRelevant(url: string, score: number): void {
    this.totalRelevantUrls++;
    this.scoreSum += score;
    if (score >= 80) {
      this.highValueUrls.push({ url, score });
    }
  }

  recordSkipped(): void {
    this.totalSkippedUrls++;
  }

  recordError(url: string, error: string): void {
    this.errors.push({ url, error });
  }

  getStats(): DiscoveryStats {
    return {
      totalUrlsScanned: this.totalUrlsScanned,
      totalRelevantUrls: this.totalRelevantUrls,
      totalSkippedUrls: this.totalSkippedUrls,
      averageScore:
        this.totalRelevantUrls > 0
          ? this.scoreSum / this.totalRelevantUrls
          : 0,
      highValueUrls: [...this.highValueUrls],
      processingTimeMs: Date.now() - this.startTime,
      errors: [...this.errors],
    };
  }

  generateReport(): string {
    const s = this.getStats();
    const pct =
      s.totalUrlsScanned > 0
        ? ((s.totalRelevantUrls / s.totalUrlsScanned) * 100).toFixed(1)
        : '0.0';
    return [
      'Brand discovery report:',
      `- URLs scanned: ${s.totalUrlsScanned}`,
      `- Relevant URLs: ${s.totalRelevantUrls} (${pct}%)`,
      `- Skipped: ${s.totalSkippedUrls}`,
      `- Average score: ${s.averageScore.toFixed(1)}`,
      `- High-value URLs (≥80): ${s.highValueUrls.length}`,
      `- Processing time: ${(s.processingTimeMs / 1000).toFixed(2)}s`,
      s.errors.length > 0 ? `- Errors: ${s.errors.length}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }
}

/** In-memory visited / score cache for a single scrape session. */
export class DiscoverySessionCache {
  private readonly visited = new Set<string>();
  private readonly discovered = new Map<string, number>();

  addVisited(url: string): void {
    this.visited.add(url);
  }

  isVisited(url: string): boolean {
    return this.visited.has(url);
  }

  addDiscovered(url: string, score: number): void {
    const prev = this.discovered.get(url) ?? 0;
    if (score > prev) this.discovered.set(url, score);
  }

  getScore(url: string): number | undefined {
    return this.discovered.get(url);
  }
}
