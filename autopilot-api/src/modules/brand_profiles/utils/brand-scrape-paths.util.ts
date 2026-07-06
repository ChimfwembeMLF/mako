import { BRAND_PATH_SLUGS } from './brand-scrape-slugs';
import {
  type BrandDiscoveryConfig,
  type BrandDiscoveryLogger,
  type DiscoveredLink,
  DEFAULT_BRAND_DISCOVERY_CONFIG,
  mergeBrandDiscoveryConfig,
  resolveLogger,
} from './brand-discovery.config';

export { BRAND_PATH_SLUGS } from './brand-scrape-slugs';
export {
  type BrandDiscoveryConfig,
  type BrandDiscoveryLogger,
  type DiscoveredLink,
  type DiscoveryStats,
  DEFAULT_BRAND_DISCOVERY_CONFIG,
  mergeBrandDiscoveryConfig,
  DebugBrandDiscoveryLogger,
  ScrapeRateLimiter,
  DiscoveryStatsCollector,
  DiscoverySessionCache,
  resolveLogger,
} from './brand-discovery.config';

/** CMS / locale / nested prefixes for seed URL generation. */
export const PATH_PREFIXES = [
  '',
  'pages',
  'page',
  'en',
  'en-us',
  'company',
  'info',
  'about',
  'our-company',
  'corporate',
  'content',
  'site',
  'web',
  'app',
  'main',
  'public',
] as const;

const ESCAPED_SLUGS = [...new Set(BRAND_PATH_SLUGS)].map((slug) =>
  slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
);

/** Pre-compiled patterns (module load). */
export const SCORE_PATTERNS = {
  about: /\/about(-us|_us)?\b|\/aboutus\b/i,
  whoWeAre:
    /who-we-are|who_we_are|our-story|our_story|our-company|sobre-nosotros|quienes-somos|a-propos|qui-sommes-nous|uber-uns|wer-wir-sind|chi-siamo/i,
  companyMission:
    /\/company\b|\/mission\b|\/vision\b|\/values\b|\/mision\b|\/missione\b/i,
  servicesProducts:
    /services|products|solutions|what-we-do|what_we_do|servicios|produits|servizi/i,
  contactFaq: /contact|faq|contacto|kontakt|contatti|contato/i,
  brandRelevant: new RegExp(`/(?:${ESCAPED_SLUGS.join('|')})(?:/|$)`, 'i'),
} as const;

const SKIP_PATH = new RegExp(
  '/(login|signin|sign-in|signup|sign-up|register|cart|checkout|wp-admin|wp-login|feed|tag|category|author|privacy-policy|terms|cookie)\\b',
  'i',
);

const ASSET_EXT = new RegExp(
  '\\.(pdf|jpe?g|png|gif|webp|svg|zip|css|js|xml|json)$',
  'i',
);

const BRAND_LINK_TEXT = new RegExp(
  '\\b(' +
    [
      'about(\\s+us)?',
      'who\\s+we\\s+are',
      'our\\s+story',
      'our\\s+company',
      'our\\s+team',
      'mission',
      'vision',
      'values',
      'services',
      'products',
      'solutions',
      'what\\s+we\\s+do',
      'company\\s+profile',
      'contact(\\s+us)?',
      'sobre\\s+nosotros',
      'quienes\\s+somos',
      'à\\s+propos',
      'qui\\s+sommes-nous',
      'über\\s+uns',
      'chi\\s+siamo',
      'sobre\\s+nós',
      'quem\\s+somos',
    ].join('|') +
    ')\\b',
  'i',
);

const INVALID_HREF = /^(#|mailto:|tel:|javascript:)/i;

export function normalizeScrapeUrl(url: string): string {
  const u = new URL(url);
  u.hash = '';
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
    u.pathname = u.pathname.slice(0, -1);
  }
  return u.href;
}

/**
 * Resolve relative, protocol-relative, and absolute URLs against a base page.
 */
export function resolveUrl(href: string, baseUrl: string): string {
  const trimmed = href.trim();
  if (!trimmed || trimmed === '/' || trimmed === './') {
    return normalizeScrapeUrl(baseUrl);
  }
  if (trimmed.startsWith('//')) {
    const protocol = new URL(baseUrl).protocol;
    return normalizeScrapeUrl(`${protocol}${trimmed}`);
  }
  if (trimmed.startsWith('/')) {
    const origin = new URL(baseUrl).origin;
    return normalizeScrapeUrl(`${origin}${trimmed}`);
  }
  try {
    return normalizeScrapeUrl(new URL(trimmed, baseUrl).href);
  } catch {
    return normalizeScrapeUrl(baseUrl);
  }
}

export function isSkippableScrapePath(pathname: string): boolean {
  return SKIP_PATH.test(pathname.toLowerCase());
}

export function findPossiblePrefixes(pathname: string): string[] {
  const segments = pathname.split('/').filter(Boolean);
  const prefixes: string[] = [];
  for (let i = 0; i < segments.length - 1; i++) {
    prefixes.push(segments.slice(0, i + 1).join('/'));
  }
  return prefixes;
}

export function pathLooksBrandRelevant(pathname: string): boolean {
  const path = pathname.toLowerCase();
  if (isSkippableScrapePath(path)) return false;
  if (SCORE_PATTERNS.brandRelevant.test(path)) return true;
  return BRAND_PATH_SLUGS.some((slug) => pathIncludesSlug(path, slug));
}

function pathIncludesSlug(path: string, slug: string): boolean {
  const normalized = slug.toLowerCase();
  return (
    path === `/${normalized}` ||
    path.endsWith(`/${normalized}`) ||
    path.includes(`/${normalized}/`) ||
    path.includes(`/${normalized}-`) ||
    path.includes(`-${normalized}`) ||
    path.includes(`_${normalized}`)
  );
}

export function scoreBrandPageUrl(
  url: string,
  linkText = '',
  config: BrandDiscoveryConfig = DEFAULT_BRAND_DISCOVERY_CONFIG,
  logger?: BrandDiscoveryLogger,
): number {
  const log = logger ?? resolveLogger(config);
  const path = new URL(url).pathname.toLowerCase();
  let score = 0;
  const reasons: string[] = [];

  if (SCORE_PATTERNS.about.test(path)) {
    score += config.aboutScore;
    reasons.push('about path');
  } else if (SCORE_PATTERNS.whoWeAre.test(path)) {
    score += config.storyScore;
    reasons.push('story/team path');
  } else if (SCORE_PATTERNS.companyMission.test(path)) {
    score += config.companyScore;
    reasons.push('company/mission path');
  } else if (SCORE_PATTERNS.servicesProducts.test(path)) {
    score += config.servicesScore;
    reasons.push('services/products path');
  } else if (SCORE_PATTERNS.contactFaq.test(path)) {
    score += config.contactScore;
    reasons.push('contact/faq path');
  } else if (pathLooksBrandRelevant(path)) {
    score += config.genericBrandScore;
    reasons.push('brand slug match');
  }

  if (BRAND_LINK_TEXT.test(linkText)) {
    score += config.linkTextBonus;
    reasons.push('link text');
  }

  const depth = path.split('/').filter(Boolean).length;
  if (depth <= 2 && depth > 0) {
    score += config.depthBonus;
    reasons.push('shallow depth');
  }

  if (depth > config.maxDepth) {
    score = Math.max(0, score - 20);
    reasons.push('depth penalty');
  }

  log.debug(`Scored ${url} = ${score}`, { path, linkText, score, reasons });
  return score;
}

export function buildSeedUrls(
  origin: string,
  customPrefixes: string[] = [],
  config: BrandDiscoveryConfig = DEFAULT_BRAND_DISCOVERY_CONFIG,
): string[] {
  const seeds = new Set<string>();
  const allPrefixes = [...PATH_PREFIXES, ...customPrefixes];

  for (const prefix of allPrefixes) {
    for (const slug of BRAND_PATH_SLUGS) {
      const path = prefix ? `/${prefix}/${slug}` : `/${slug}`;
      seeds.add(normalizeScrapeUrl(`${origin}${path}`));
    }
  }

  const ranked = [...seeds]
    .map((url) => ({
      url,
      score: scoreBrandPageUrl(url, '', config),
    }))
    .sort((a, b) => b.score - a.score);

  return ranked.slice(0, config.maxSeedUrls).map((entry) => entry.url);
}

export function rankDiscoveredLinks(
  anchors: Array<{ href: string; text: string }>,
  pageUrl: string,
  config: BrandDiscoveryConfig = DEFAULT_BRAND_DISCOVERY_CONFIG,
): DiscoveredLink[] {
  const origin = new URL(pageUrl).origin;
  const ranked = new Map<string, number>();
  const logger = resolveLogger(config);

  for (const { href, text } of anchors) {
    const trimmed = href.trim();
    if (!trimmed || INVALID_HREF.test(trimmed)) continue;

    try {
      const abs = resolveUrl(trimmed, pageUrl);
      if (!abs.startsWith(origin)) continue;
      if (ASSET_EXT.test(abs)) continue;

      const path = new URL(abs).pathname;
      if (isSkippableScrapePath(path)) continue;

      const linkText = text.replace(/\s+/g, ' ').trim();
      const relevant =
        pathLooksBrandRelevant(path) || BRAND_LINK_TEXT.test(linkText);
      if (!relevant) continue;

      const score = scoreBrandPageUrl(abs, linkText, config, logger);
      const prev = ranked.get(abs) ?? 0;
      if (score > prev) ranked.set(abs, score);
    } catch {
      /* ignore bad URLs */
    }
  }

  return [...ranked.entries()]
    .map(([url, score]) => ({ url, score }))
    .sort((a, b) => b.score - a.score);
}

export function buildFetchQueue(
  baseUrl: string,
  config: BrandDiscoveryConfig = DEFAULT_BRAND_DISCOVERY_CONFIG,
): string[] {
  const normalized = normalizeScrapeUrl(baseUrl);
  const origin = new URL(normalized).origin;
  const dynamicPrefixes = findPossiblePrefixes(new URL(normalized).pathname);
  const seeds = buildSeedUrls(origin, dynamicPrefixes, config);

  const seedScores = seeds.map((url) => ({
    url,
    score: scoreBrandPageUrl(url, '', config),
  }));
  seedScores.sort((a, b) => b.score - a.score);

  const ordered: string[] = [normalized];
  const seen = new Set<string>([normalized]);

  for (const { url } of seedScores) {
    if (!seen.has(url)) {
      seen.add(url);
      ordered.push(url);
    }
  }

  return ordered;
}

export function mergeDiscoveredIntoQueue(
  queue: string[],
  discovered: DiscoveredLink[],
  visited: Set<string>,
  config: BrandDiscoveryConfig = DEFAULT_BRAND_DISCOVERY_CONFIG,
): string[] {
  const existing = new Set(queue);
  const toPrepend: string[] = [];

  for (const { url, score } of discovered) {
    if (visited.has(url) || existing.has(url)) continue;
    if (score < config.minScoreForQueue) continue;
    toPrepend.push(url);
    existing.add(url);
  }

  return [...toPrepend, ...queue];
}

/** Factory returning config-bound discovery helpers. */
export function createBrandDiscovery(
  partial: Partial<BrandDiscoveryConfig> = {},
) {
  const config = mergeBrandDiscoveryConfig(partial);
  const logger = resolveLogger(config);
  return {
    config,
    normalizeScrapeUrl,
    resolveUrl,
    scoreBrandPageUrl: (url: string, linkText = '') =>
      scoreBrandPageUrl(url, linkText, config, logger),
    rankDiscoveredLinks: (
      anchors: Array<{ href: string; text: string }>,
      pageUrl: string,
    ) => rankDiscoveredLinks(anchors, pageUrl, config),
    buildFetchQueue: (baseUrl: string) => buildFetchQueue(baseUrl, config),
    mergeDiscoveredIntoQueue: (
      queue: string[],
      discovered: DiscoveredLink[],
      visited: Set<string>,
    ) => mergeDiscoveredIntoQueue(queue, discovered, visited, config),
    buildSeedUrls: (origin: string, customPrefixes: string[] = []) =>
      buildSeedUrls(origin, customPrefixes, config),
  };
}
