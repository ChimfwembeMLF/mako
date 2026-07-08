/**
 * Brand-relevant URL path slugs across languages and site structures.
 *
 * Language coverage (paths checked regardless of page language):
 * | Language   | Example slugs                                      |
 * |------------|----------------------------------------------------|
 * | English    | about, about-us, who-we-are, our-story, company    |
 * | Spanish    | sobre-nosotros, quienes-somos, contacto            |
 * | French     | a-propos, qui-sommes-nous, contactez-nous          |
 * | German     | uber-uns, wer-wir-sind, kontakt                    |
 * | Italian    | chi-siamo, la-nostra-storia, contatti              |
 * | Portuguese | sobre-nos, quem-somos, contato                     |
 * | Japanese   | kaisha, kigyou (romaji)                            |
 * | Chinese    | guanyu-women, gongsi (pinyin)                      |
 */
export const BRAND_PATH_SLUGS = [
  // English
  'about',
  'about-us',
  'about_us',
  'aboutus',
  'who-we-are',
  'who_we_are',
  'our-story',
  'our_story',
  'our-company',
  'our-team',
  'company',
  'mission',
  'vision',
  'values',
  'services',
  'products',
  'solutions',
  'what-we-do',
  'what_we_do',
  'faq',
  'faqs',
  'contact',
  'contact-us',
  'contact_us',
  'work',
  'portfolio',
  'industries',

  // Spanish
  'sobre-nosotros',
  'sobre_nosotros',
  'quienes-somos',
  'nuestra-historia',
  'nuestra-empresa',
  'nuestro-equipo',
  'mision',
  'valores',
  'servicios',
  'productos',
  'soluciones',
  'contacto',

  // French
  'a-propos',
  'qui-sommes-nous',
  'notre-histoire',
  'notre-entreprise',
  'notre-equipe',
  'produits',
  'contactez-nous',

  // German
  'uber-uns',
  'uber_uns',
  'wer-wir-sind',
  'unsere-geschichte',
  'unsere-firma',
  'unser-team',
  'werte',
  'dienstleistungen',
  'produkte',
  'losungen',
  'kontakt',

  // Italian
  'chi-siamo',
  'la-nostra-storia',
  'la-nostra-azienda',
  'il-nostro-team',
  'missione',
  'visione',
  'valori',
  'servizi',
  'prodotti',
  'soluzioni',
  'contatti',

  // Portuguese
  'sobre-nos',
  'quem-somos',
  'nossa-historia',
  'nossa-empresa',
  'nosso-time',
  'missao',
  'visao',
  'servicos',
  'produtos',
  'solucoes',
  'contato',

  // Japanese (romaji) / Chinese (pinyin)
  'kabushiki-gaisha',
  'kaisha',
  'gaisha',
  'kigyou',
  'kigyō',
  'purofiru',
  'guanyu-women',
  'women-de-gushi',
  'gongsi',
  'chanpin',
  'fuwu',

  // Nested / corporate structures
  'company/about',
  'company/team',
  'company/careers',
  'corporate',
  'corporate/about',
  'corporate/team',

  // Careers & HR
  'careers',
  'career',
  'jobs',
  'working-at',
  'join-us',
  'joinus',
  'opportunities',
  'employment',
  'recruitment',
  'career-opportunities',
  'career-portal',

  // Culture
  'culture',
  'company-culture',
  'our-culture',
  'life-at',
  'benefits',
  'perks',
  'wellness',

  // Leadership
  'leadership',
  'management',
  'executives',
  'executive-team',
  'board-of-directors',
  'board',
  'governance',

  // Investors
  'investors',
  'investor-relations',
  'ir',
  'stock',
  'shareholders',
  'financials',
  'earnings',

  // Press & media
  'press',
  'media',
  'newsroom',
  'press-kit',
  'presskit',
  'news',
  'updates',
  'announcements',
  'press-releases',

  // Partners
  'partners',
  'partnerships',
  'affiliates',
  'ecosystem',
  'resellers',
  'distributors',

  // Social proof
  'testimonials',
  'reviews',
  'case-studies',
  'casestudies',
  'success-stories',
  'customers',
  'client-stories',

  // Recognition
  'awards',
  'recognition',
  'achievements',
  'accolades',

  // CSR
  'sustainability',
  'esg',
  'csr',
  'social-responsibility',
  'environmental',
  'diversity',
  'inclusion',
  'equity',
  'community',
  'giving',
  'philanthropy',

  // Events
  'events',
  'webinars',
  'conferences',
  'seminars',
  'appearances',
  'speaking',

  // Resources
  'resources',
  'resource-center',
  'knowledge-base',
  'learning',
  'education',
  'training',

  // Product depth
  'platform',
  'technology',
  'innovation',
  'research',
  'capabilities',
  'expertise',
  'methodology',

  // Geographic
  'locations',
  'offices',
  'headquarters',
  'global',
  'international',
  'regional',
] as const;

export type BrandPathSlug = (typeof BRAND_PATH_SLUGS)[number];
