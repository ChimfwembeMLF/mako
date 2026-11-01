import { extractPageText } from './page-text.util';

const inertiaPage = (props: unknown) => `<html><head>
  <title>Kalulu Books</title>
  <meta name="description" content="Buy full Zambian books.">
  <script>var ignored = 'tracking code';</script>
</head><body><div id="app" data-page="${JSON.stringify({ component: 'Index', props })
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')}"></div></body></html>`;

describe('extractPageText', () => {
  it('uses the visible body when the page has one', () => {
    const body = 'We sell great books to readers across Zambia. '.repeat(10);
    const { title, text } = extractPageText(
      `<html><head><title>Shop</title><meta name="description" content="Meta only"></head>
       <body><nav>Menu</nav><main>${body}</main><script>x()</script></body></html>`,
    );
    expect(title).toBe('Shop');
    expect(text).toContain('We sell great books');
    expect(text).not.toContain('Meta only');
    expect(text).not.toContain('Menu');
  });

  it('reads an Inertia page whose body is empty', () => {
    const { title, text } = extractPageText(
      inertiaPage({
        warehouseAddress: 'Thabo Mbeki Road, Lusaka',
        latestBooks: [
          {
            id: 4,
            title: 'Faith and Money',
            slug: 'faith-and-money',
            status: 'available',
            cover_image_url: 'https://cdn.example/a.png',
            created_at: '2026-10-12T10:12:58.000000Z',
            description: '<p>Empowers readers to handle money well.</p>',
            author: { name: 'Darius Mwaba' },
          },
        ],
      }),
    );
    expect(title).toBe('Kalulu Books');
    expect(text).toContain('description: Buy full Zambian books.');
    expect(text).toContain('warehouseAddress: Thabo Mbeki Road, Lusaka');
    expect(text).toContain('title: Faith and Money');
    expect(text).toContain('description: Empowers readers to handle money well.');
    expect(text).toContain('name: Darius Mwaba');
    for (const noise of ['faith-and-money', 'cdn.example', '2026-10-12', 'available', '<p>']) {
      expect(text).not.toContain(noise);
    }
  });

  it('leaves out session and account state', () => {
    const { text } = extractPageText(
      inertiaPage({
        auth: { user: { name: 'Private Person', email: 'private@x.co' } },
        flash: { success: 'Secret flash message' },
        about: 'A public story about the brand',
      }),
    );
    expect(text).toContain('A public story');
    expect(text).not.toContain('Private Person');
    expect(text).not.toContain('private@x.co');
    expect(text).not.toContain('Secret flash');
  });

  it('reads JSON-LD and Next.js page data', () => {
    const { text } = extractPageText(`<html><body><div id="__next"></div>
      <script type="application/ld+json">{"@type":"Organization","name":"Acme Ltd"}</script>
      <script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"intro":"Hello from Acme team"}}}</script>
    </body></html>`);
    expect(text).toContain('name: Acme Ltd');
    expect(text).toContain('intro: Hello from Acme team');
  });

  it('survives broken embedded data', () => {
    const { text } = extractPageText(
      `<html><head><meta name="description" content="Still fine"></head>
       <body><div data-page="{broken"></div><script type="application/ld+json">{nope</script></body></html>`,
    );
    expect(text).toBe('description: Still fine');
  });

  it('returns nothing for a truly empty page', () => {
    expect(extractPageText('<html><body><div id="app"></div></body></html>').text).toBe('');
  });
});
