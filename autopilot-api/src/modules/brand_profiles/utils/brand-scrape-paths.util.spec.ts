import { BRAND_PATH_SLUGS } from './brand-scrape-slugs';
import {
  buildFetchQueue,
  buildSeedUrls,
  createBrandDiscovery,
  mergeDiscoveredIntoQueue,
  normalizeScrapeUrl,
  pathLooksBrandRelevant,
  rankDiscoveredLinks,
  resolveUrl,
  scoreBrandPageUrl,
  DEFAULT_BRAND_DISCOVERY_CONFIG,
  mergeBrandDiscoveryConfig,
  DiscoveryStatsCollector,
} from './brand-scrape-paths.util';

describe('brand-scrape-paths.util', () => {
  const origin = 'https://example.com';

  describe('slug coverage', () => {
    it('supports 75+ unique path slugs', () => {
      expect(new Set(BRAND_PATH_SLUGS).size).toBeGreaterThanOrEqual(75);
    });

    it('includes multilingual about paths', () => {
      expect(BRAND_PATH_SLUGS).toEqual(
        expect.arrayContaining([
          'about',
          'sobre-nosotros',
          'a-propos',
          'uber-uns',
          'chi-siamo',
          'sobre-nos',
        ]),
      );
    });
  });

  describe('resolveUrl', () => {
    it('resolves protocol-relative URLs', () => {
      expect(resolveUrl('//example.com/about', `${origin}/`)).toBe(
        `${origin}/about`,
      );
    });

    it('resolves root-relative paths', () => {
      expect(resolveUrl('/about', `${origin}/page`)).toBe(`${origin}/about`);
    });

    it('falls back to base for empty href', () => {
      expect(resolveUrl('', `${origin}/about`)).toBe(`${origin}/about`);
    });

    it('normalizes trailing slashes', () => {
      expect(resolveUrl('/about/', `${origin}/`)).toBe(`${origin}/about`);
    });
  });

  describe('pathLooksBrandRelevant', () => {
    it('matches English and Spanish about paths', () => {
      expect(pathLooksBrandRelevant('/about')).toBe(true);
      expect(pathLooksBrandRelevant('/es/sobre-nosotros')).toBe(true);
      expect(pathLooksBrandRelevant('/pages/a-propos')).toBe(true);
    });

    it('skips login and checkout paths', () => {
      expect(pathLooksBrandRelevant('/login')).toBe(false);
      expect(pathLooksBrandRelevant('/checkout')).toBe(false);
    });
  });

  describe('scoreBrandPageUrl', () => {
    it('gives highest score to about pages', () => {
      expect(scoreBrandPageUrl(`${origin}/about`)).toBeGreaterThanOrEqual(100);
      expect(scoreBrandPageUrl(`${origin}/about-us`)).toBeGreaterThanOrEqual(
        100,
      );
    });

    it('adds link text bonus', () => {
      const url = `${origin}/team`;
      expect(scoreBrandPageUrl(url, 'About us')).toBeGreaterThan(
        scoreBrandPageUrl(url, ''),
      );
    });

    it('respects configurable thresholds', () => {
      const cfg = mergeBrandDiscoveryConfig({
        aboutScore: 200,
        linkTextBonus: 10,
      });
      expect(
        scoreBrandPageUrl(`${origin}/about`, '', cfg),
      ).toBeGreaterThanOrEqual(200);
    });
  });

  describe('rankDiscoveredLinks', () => {
    it('treats common about path variants as brand-relevant', () => {
      for (const path of ['/about', '/about-us', '/pages/about', '/en/about']) {
        const url = `${origin}${path}`;
        const [ranked] = rankDiscoveredLinks(
          [{ href: path, text: 'About' }],
          `${origin}/`,
        );
        expect(ranked?.url).toBe(normalizeScrapeUrl(url));
        expect(ranked?.score).toBeGreaterThan(50);
      }
    });

    it('discovers Spanish links', () => {
      const [ranked] = rankDiscoveredLinks(
        [{ href: '/sobre-nosotros', text: 'Sobre nosotros' }],
        `${origin}/`,
      );
      expect(ranked?.url).toBe(`${origin}/sobre-nosotros`);
      expect(ranked?.score).toBeGreaterThan(50);
    });

    it('filters non-brand links', () => {
      const results = rankDiscoveredLinks(
        [
          { href: '/login', text: 'Login' },
          { href: '/about', text: 'About Us' },
        ],
        `${origin}/`,
      );
      expect(results).toHaveLength(1);
      expect(results[0].url).toContain('/about');
    });

    it('discovers links from anchor text when path is opaque', () => {
      const [ranked] = rankDiscoveredLinks(
        [{ href: '/team-info', text: 'Who we are' }],
        `${origin}/`,
      );
      expect(ranked?.url).toBe(`${origin}/team-info`);
      expect(ranked?.score).toBeGreaterThanOrEqual(35);
    });
  });

  describe('buildFetchQueue', () => {
    it('prioritizes /about before lower-value seeds', () => {
      const queue = buildFetchQueue(`${origin}/`);
      const aboutIdx = queue.indexOf(`${origin}/about`);
      const newsIdx = queue.indexOf(`${origin}/news`);
      expect(aboutIdx).toBeGreaterThan(0);
      if (newsIdx > 0) {
        expect(aboutIdx).toBeLessThan(newsIdx);
      }
      expect(scoreBrandPageUrl(`${origin}/about`)).toBeGreaterThan(
        scoreBrandPageUrl(`${origin}/news`),
      );
    });

    it('keeps user-provided deep URLs first', () => {
      const queue = buildFetchQueue(`${origin}/company/about`);
      expect(queue[0]).toBe(`${origin}/company/about`);
    });
  });

  describe('mergeDiscoveredIntoQueue', () => {
    it('respects minScoreForQueue config', () => {
      const cfg = mergeBrandDiscoveryConfig({ minScoreForQueue: 200 });
      const merged = mergeDiscoveredIntoQueue(
        [`${origin}/`],
        [{ url: `${origin}/low`, score: 40 }],
        new Set(),
        cfg,
      );
      expect(merged).toHaveLength(1);
    });
  });

  describe('buildSeedUrls', () => {
    it('caps seeds by maxSeedUrls', () => {
      const cfg = mergeBrandDiscoveryConfig({ maxSeedUrls: 10 });
      expect(buildSeedUrls(origin, [], cfg).length).toBeLessThanOrEqual(10);
    });
  });

  describe('createBrandDiscovery', () => {
    it('returns config-bound helpers', () => {
      const discovery = createBrandDiscovery({ aboutScore: 150 });
      expect(discovery.config.aboutScore).toBe(150);
      expect(
        discovery.scoreBrandPageUrl(`${origin}/about`),
      ).toBeGreaterThanOrEqual(150);
    });
  });

  describe('DiscoveryStatsCollector', () => {
    it('generates a human-readable report', () => {
      const stats = new DiscoveryStatsCollector();
      stats.recordScanned();
      stats.recordRelevant(`${origin}/about`, 100);
      const report = stats.generateReport();
      expect(report).toContain('URLs scanned: 1');
      expect(report).toContain('Relevant URLs: 1');
    });
  });

  describe('performance', () => {
    it('scores 1000 URLs within reasonable time', () => {
      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        scoreBrandPageUrl(`${origin}/about-${i % 50}`, 'About us');
      }
      expect(Date.now() - start).toBeLessThan(500);
    });
  });
});
