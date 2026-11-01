import { createServer, type Server } from 'http';
import type { AddressInfo } from 'net';
import { ScrapeWebsiteService } from './scrape-website.service';

jest.mock('../../ai/services/ai-provider-router.service', () => ({
  AiProviderRouter: class {},
}));
jest.mock('../../ai/services/ai-usage-tracker.service', () => ({
  AiUsageTrackerService: class {},
}));

describe('ScrapeWebsiteService fetching', () => {
  let server: Server;
  let base: string;
  let hits: string[];
  let respond: (url: string) => { status: number; body?: string; type?: string };

  const fetchFrom = (url: string, allowPrivate = true) => {
    const config = {
      get: (key: string) =>
        key === 'SCRAPE_ALLOW_PRIVATE_HOSTS' && allowPrivate ? 'true' : undefined,
    } as any;
    const service = new ScrapeWebsiteService(config, {} as any, {} as any);
    return (service as any).fetchPages(
      url,
      3,
      2000,
      (service as any).discoveryConfig(),
    );
  };
  const fetchPages = () => fetchFrom(base);

  beforeAll(async () => {
    server = createServer((req, res) => {
      hits.push(req.url ?? '');
      const { status, body = '', type = 'text/html' } = respond(req.url ?? '');
      res.writeHead(status, { 'Content-Type': type });
      res.end(body);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  });

  afterAll(() => new Promise((resolve) => server.close(resolve)));

  beforeEach(() => {
    hits = [];
  });

  it('stops at the first refusal and says the site blocks automated visitors', async () => {
    respond = () => ({ status: 403 });
    await expect(fetchPages()).rejects.toThrow("doesn't allow automated visitors");
    expect(hits).toHaveLength(1);
  });

  it('gives up after a run of page misses instead of walking every seed', async () => {
    respond = () => ({ status: 404 });
    await expect(fetchPages()).rejects.toThrow('Could not fetch any pages');
    expect(hits.length).toBeLessThanOrEqual(10);
  });

  it('keeps going past missing pages and returns the ones it could read', async () => {
    respond = (url) =>
      url === '/'
        ? { status: 404 }
        : { status: 200, body: '<title>About</title><main>We make boats</main>' };
    const pages = await fetchPages();
    expect(pages[0]).toContain('We make boats');
  });

  it('says the site was reached when no page has readable text', async () => {
    respond = (url) =>
      url === '/' ? { status: 200, body: '<div id="app"></div>' } : { status: 404 };
    await expect(fetchPages()).rejects.toThrow('reached that website');
  });

  it('reads content a JavaScript app embeds in the page', async () => {
    const data = JSON.stringify({ props: { about: 'We publish Zambian books' } }).replace(/"/g, '&quot;');
    respond = (url) =>
      url === '/'
        ? { status: 200, body: `<title>Kalulu</title><div id="app" data-page="${data}"></div>` }
        : { status: 404 };
    const pages = await fetchPages();
    expect(pages[0]).toContain('We publish Zambian books');
  });

  it('does not count identical pages twice', async () => {
    respond = () => ({ status: 200, body: '<main>Same page everywhere</main>' });
    const pages = await fetchPages();
    expect(pages).toHaveLength(1);
  });

  it('reports no text, not a fetch failure, for a non-HTML response', async () => {
    respond = () => ({ status: 200, body: '{"a":1}', type: 'application/json' });
    await expect(fetchPages()).rejects.toThrow('Could not extract text');
  });

  it('explains when the host cannot be reached', async () => {
    await expect(fetchFrom('http://127.0.0.1:1/')).rejects.toThrow("couldn't connect");
  });

  it('never touches a private address given as an IP', async () => {
    respond = () => ({ status: 200, body: '<main>internal</main>' });
    await expect(fetchFrom(base, false)).rejects.toThrow("isn't a public website");
    expect(hits).toHaveLength(0);
  });

  it('never touches a hostname that resolves to a private address', async () => {
    respond = () => ({ status: 200, body: '<main>internal</main>' });
    const port = new URL(base).port;
    await expect(fetchFrom(`http://localhost:${port}/`, false)).rejects.toThrow(
      "isn't a public website",
    );
    expect(hits).toHaveLength(0);
  });
});
