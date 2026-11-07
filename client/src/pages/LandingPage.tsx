import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { plansApi, type PublicPlan } from '@/lib/api';
import { planFeatureBullets } from '@/lib/plans';
import {
  Brain, Pen, CalendarClock, BarChart3, CheckCircle2, ArrowRight,
  Menu, X, MessageSquareReply, Shield, Link2,
  TrendingUp, Users, Globe, Check, Smartphone,
} from 'lucide-react';
import {
  ScreenshotFrame,
  type ScreenshotDevice,
  MockBrandBrain,
  MockContentEngine,
  MockPublish,
  MockScheduler,
  MockAnalytics,
  MockReplies,
} from '@/components/landing/ProductMocks';
import Logo from '@/components/Logo';
import { cn } from '@/lib/utils';
import { GuestAdUnit } from '@/components/GuestAdUnit';
import { COMPANY, COMPANY_BYLINE } from '@/config/company';

function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVisible(true);
      },
      { threshold },
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

// Classes rather than inline styles, so the motion-reduce overrides can win.
function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, visible } = useInView(0.14);
  return (
    <div
      ref={ref}
      className={cn(
        'transition-[opacity,transform] duration-500 ease-out',
        'motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
        className,
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function SectionHeader({
  label,
  title,
  desc,
  className = '',
}: {
  label: string;
  title: string;
  desc?: string;
  className?: string;
}) {
  return (
    <div className={cn('text-center w-full', className)}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-3">{label}</p>
      <h2 className="font-display text-display-md sm:text-4xl font-extrabold tracking-tight">{title}</h2>
      {desc && <p className="text-muted-foreground mt-3 leading-relaxed">{desc}</p>}
    </div>
  );
}

const SHOWCASE: Array<{
  id: string;
  badge: string;
  title: string;
  desc: string;
  img: string;
  mock: React.ReactNode;
  icon: typeof Brain;
  device: ScreenshotDevice;
}> = [
    {
      id: 'brand-brain',
      badge: 'Brand Brain',
      title: 'Define how your brand sounds',
      desc: 'Set your profile, tone, audience, and key messages once. Every post follows the same guidelines.',
      img: '/screenshots/mako-brand-brain-tablet.webp',
      mock: <MockBrandBrain />,
      icon: Brain,
      device: 'tablet',
    },
    {
      id: 'content',
      badge: 'Content Engine',
      title: 'Draft posts for every channel',
      desc: 'Turn one idea into copy sized for Facebook, Instagram, LinkedIn, email, and ads — without rewriting from scratch.',
      img: '/screenshots/mako-content-engine-desktop.webp',
      mock: <MockContentEngine />,
      icon: Pen,
      device: 'desktop',
    },
    {
      id: 'publish',
      badge: 'Publishing',
      title: 'Review once, post everywhere',
      desc: 'Preview how posts look on each platform, attach media, and publish through your connected accounts.',
      img: '/screenshots/mako-publishing-desktop.webp',
      mock: <MockPublish />,
      icon: Globe,
      device: 'desktop',
    },
    {
      id: 'scheduler',
      badge: 'Scheduler',
      title: 'Keep your calendar full',
      desc: 'Queue posts on a visual calendar and publish on the dates and times you choose.',
      img: '/screenshots/mako-scheduler.webp',
      mock: <MockScheduler />,
      icon: CalendarClock,
      device: 'tablet',
    },
    {
      id: 'analytics',
      badge: 'Analytics',
      title: 'See what is working',
      desc: 'Track reach, engagement, and leads in one place so you can focus on what drives results.',
      img: '/screenshots/mako-analytics-desktop.webp',
      mock: <MockAnalytics />,
      icon: BarChart3,
      device: 'desktop',
    },
    {
      id: 'replies',
      badge: 'Inbox',
      title: 'Reply from one queue',
      desc: 'Comments from your posts land in a single inbox. Review, edit, and send replies without switching apps.',
      img: '/screenshots/mako-replies-tablet.webp',
      mock: <MockReplies />,
      icon: MessageSquareReply,
      device: 'tablet',
    },
  ];

function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-colors duration-300 ${scrolled ? 'bg-card/95 backdrop-blur border-b border-border' : 'bg-transparent'}`}>
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center">
          <Logo className="h-9" />
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-nav-link text-foreground">
          {[['#product', 'Product'], ['#features', 'Features'], ['#pricing', 'Pricing']].map(([href, label]) => (
            <a key={href} href={href} className="hover:opacity-70 transition-opacity">{label}</a>
          ))}
          <Link to="/download" className="hover:opacity-70 transition-opacity">Android app</Link>
        </nav>
        <div className="hidden md:flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild><Link to="/auth">Sign in</Link></Button>
          <Button size="sm" asChild className="group rounded-xl min-h-12 h-12 px-5 transition-shadow duration-200 hover:shadow-md hover:shadow-primary/20">
            <Link to="/auth?mode=signup">Get started <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" /></Link>
          </Button>
        </div>
        <button type="button" className="md:hidden p-2" onClick={() => setOpen((o) => !o)} aria-label="Menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t bg-card px-4 pb-4 space-y-2">
          {[['#product', 'Product'], ['#features', 'Features'], ['#pricing', 'Pricing']].map(([href, label]) => (
            <a key={href} href={href} className="block py-2 text-sm font-semibold" onClick={() => setOpen(false)}>{label}</a>
          ))}
          <Link to="/download" className="block py-2 text-sm font-semibold" onClick={() => setOpen(false)}>Android app</Link>
          <Button className="w-full mt-2 min-h-12 rounded-xl" asChild>
            <Link to="/auth?mode=signup">Get started</Link>
          </Button>
        </div>
      )}
    </header>
  );
}

/** The dashboard screenshot as a full-bleed, tilted background behind the hero copy. */
function HeroBackdrop() {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="absolute inset-0">
        <div className="absolute left-[8%] top-[8%] w-[170%] sm:left-[20%] sm:w-[125%] lg:left-[38%] lg:top-[15%] lg:w-[88%]">
          <img
            src="/screenshots/mako-dashboard-desktop.webp"
            alt=""
            width={2900}
            height={1666}
            loading="eager"
            {...{ fetchpriority: 'high' }}
            onLoad={() => setLoaded(true)}
            className={cn(
              'w-full h-auto rounded-3xl border border-border/60 shadow-2xl',
              // A flat tilt of a few degrees; change the angle here.
              '-rotate-6 [transform-origin:left_center]',
              'transition-opacity duration-700 ease-out motion-reduce:transition-none',
              loaded ? 'opacity-100' : 'opacity-0',
            )}
          />
        </div>
      </div>
      {/* Keeps the copy readable: a solid wash on phones, a short left-to-right fade on desktop. */}
      <div className="absolute inset-0 bg-card/85 lg:bg-transparent lg:bg-gradient-to-r lg:from-card lg:from-30% lg:via-card/85 lg:via-42% lg:to-card/0 lg:to-62%" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-card to-transparent" />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative isolate min-h-[92svh] flex items-center pt-24 pb-section overflow-hidden bg-card">
      <HeroBackdrop />
      <div className="relative max-w-[1200px] mx-auto px-4 sm:px-6 w-full">
        <div className="max-w-xl space-y-7 text-center mx-auto lg:mx-0 lg:text-left">
          <Reveal>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary mb-2">
              Mako
            </p>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="font-display text-display-xl bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/70">
              Your brand voice.
              <br />
              Every channel.
              <br />
              One workspace.
            </h1>
          </Reveal>

          <Reveal delay={140}>
            <p className="text-lg text-body max-w-lg mx-auto lg:mx-0 leading-relaxed">
              Plan content, publish to social, reply to comments, and follow up on leads — without switching between a dozen tabs.
            </p>
          </Reveal>

          <Reveal delay={280}>
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start pt-1">
              <Button
                size="lg"
                asChild
                className="group min-h-12 h-12 px-8 rounded-xl transition-shadow duration-200 hover:shadow-lg hover:shadow-primary/20"
              >
                <Link to="/auth?mode=signup">
                  Get started free
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="min-h-12 h-12 px-8 rounded-xl">
                <a href="#product">See how it works</a>
              </Button>
            </div>
          </Reveal>

          <Reveal delay={360}>
            <ul className="flex flex-col sm:flex-row flex-wrap gap-x-6 gap-y-2 justify-center lg:justify-start text-sm text-body">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-positive-deep shrink-0" />
                No credit card required
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-positive-deep shrink-0" />
                Mobile money billing
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-positive-deep shrink-0" />
                Built in Zambia
              </li>
            </ul>
          </Reveal>
        </div>

      </div>
    </section>
  );
}

function ProductShowcase() {
  return (
    <section id="product" className="py-section bg-card overflow-hidden">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 mb-10 lg:mb-20">
        <Reveal>
          <SectionHeader
            label="Product"
            title="From brief to published post"
            desc="Six steps that share the same brand context — follow the road from your first idea to results."
          />
        </Reveal>
      </div>
      <RoadmapTimeline />
      <RoadmapCarousel />
    </section>
  );
}

function StepBadge({ step, reached }: { step: (typeof SHOWCASE)[number]; reached: boolean }) {
  return (
    <p
      className={cn(
        'inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide transition-colors duration-300',
        reached ? 'text-primary' : 'text-muted-foreground',
      )}
    >
      <step.icon className="h-3.5 w-3.5" />
      {step.badge}
    </p>
  );
}

/** Desktop: a vertical road whose line fills, and whose stops light up, as you scroll. */
function RoadmapTimeline() {
  const trackRef = useRef<HTMLOListElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [reached, setReached] = useState(-1);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const track = trackRef.current;
      // Hidden below lg, so there is nothing to measure.
      if (!track || track.offsetParent === null) return;
      const line = window.innerHeight * 0.55;
      const rect = track.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, (line - rect.top) / rect.height));
      if (fillRef.current) fillRef.current.style.transform = `scaleY(${progress})`;
      let last = -1;
      stepRefs.current.forEach((el, i) => {
        if (el && el.getBoundingClientRect().top + el.offsetHeight / 2 < line) last = i;
      });
      setReached(last);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  return (
    <div className="hidden lg:block max-w-7xl mx-auto px-6">
      <div className="relative">
        <div className="pointer-events-none absolute left-1/2 top-6 bottom-6 w-0.5 -translate-x-1/2 rounded-full bg-border" aria-hidden>
          <div ref={fillRef} className="h-full w-full origin-top rounded-full bg-primary" style={{ transform: 'scaleY(0)' }} />
        </div>
        <ol ref={trackRef} className="relative space-y-28">
          {SHOWCASE.map((s, i) => {
            const isReached = i <= reached;
            const textFirst = i % 2 === 0;
            return (
              <li
                key={s.id}
                ref={(el) => { stepRefs.current[i] = el; }}
                className="relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-12"
              >
                <Reveal className={cn('row-start-1 space-y-4', textFirst ? 'col-start-1 justify-self-end max-w-md' : 'col-start-3 max-w-md')}>
                  <p className="font-display text-sm font-extrabold tracking-wide text-muted-foreground">
                    Step {String(i + 1).padStart(2, '0')}
                  </p>
                  <StepBadge step={s} reached={isReached} />
                  <h3 className="text-2xl sm:text-3xl font-bold font-display leading-tight tracking-tight">{s.title}</h3>
                  <p className="text-muted-foreground text-base leading-relaxed">{s.desc}</p>
                  <Button variant="outline" asChild className="group rounded-xl">
                    <Link to="/auth?mode=signup">
                      Open {s.badge}
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:group-hover:translate-x-0" />
                    </Link>
                  </Button>
                </Reveal>

                <div className="col-start-2 row-start-1 relative z-10 flex justify-center">
                  <span
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-full border-2 font-display text-base font-extrabold',
                      'transition-[background-color,border-color,color,transform,box-shadow] duration-300 ease-out motion-reduce:transition-none',
                      isReached
                        ? 'scale-100 border-primary bg-primary text-primary-foreground shadow-[0_0_0_8px_hsl(var(--primary)/0.15)]'
                        : 'scale-90 border-border bg-card text-muted-foreground',
                    )}
                  >
                    {isReached ? <s.icon className="h-5 w-5" /> : i + 1}
                  </span>
                </div>

                <Reveal delay={120} className={cn('row-start-1', textFirst ? 'col-start-3' : 'col-start-1')}>
                  <ScreenshotFrame src={s.img} alt={s.title} mock={s.mock} device={s.device} />
                </Reveal>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/** Phones and tablets: swipeable step cards under a small roadmap rail. */
function RoadmapCarousel() {
  const scrollerRef = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(0);
  const last = SHOWCASE.length - 1;

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const cards = Array.from(scroller.children) as HTMLElement[];
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(cards.indexOf(e.target as HTMLElement));
        });
      },
      { root: scroller, threshold: 0.6 },
    );
    cards.forEach((c) => obs.observe(c));
    return () => obs.disconnect();
  }, []);

  const goTo = (i: number) => {
    const scroller = scrollerRef.current;
    const card = scroller?.children[i] as HTMLElement | undefined;
    if (!scroller || !card) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scroller.scrollTo({
      left: card.offsetLeft - (scroller.clientWidth - card.clientWidth) / 2,
      behavior: reduce ? 'auto' : 'smooth',
    });
  };

  return (
    <div className="lg:hidden">
      <div className="mx-auto max-w-md px-6 mb-6">
        <div className="relative flex items-center justify-between">
          <div className="absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-border" aria-hidden>
            <div
              className="h-full origin-left rounded-full bg-primary transition-transform duration-300 ease-out motion-reduce:transition-none"
              style={{ transform: `scaleX(${active / last})` }}
            />
          </div>
          {SHOWCASE.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Step ${i + 1}: ${s.badge}`}
              aria-current={i === active ? 'step' : undefined}
              className={cn(
                'relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-bold',
                'transition-[background-color,border-color,color,transform] duration-300 motion-reduce:transition-none',
                i <= active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground',
                i === active && 'scale-110',
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      <ol
        ref={scrollerRef}
        aria-label="Product steps"
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-[7.5%] pb-4 sm:px-[20%] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {SHOWCASE.map((s, i) => (
          <li
            key={s.id}
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${SHOWCASE.length}`}
            className={cn(
              'flex w-[85%] shrink-0 snap-center flex-col rounded-2xl border bg-card p-5 sm:w-[60%]',
              'transition-[opacity,transform,border-color] duration-300 ease-out motion-reduce:transition-none',
              i === active ? 'border-primary/40 shadow-card' : 'border-border/80 opacity-60 scale-[0.96] motion-reduce:scale-100',
            )}
          >
            <div className="flex items-center justify-between">
              <StepBadge step={s} reached={i === active} />
              <span className="text-xs font-semibold text-muted-foreground">
                {i + 1} / {SHOWCASE.length}
              </span>
            </div>
            <h3 className="mt-3 text-xl font-bold font-display leading-tight tracking-tight">{s.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            <div className="flex flex-1 items-center pt-5">
              <ScreenshotFrame
                src={s.img}
                alt={s.title}
                mock={s.mock}
                device={s.device}
                className={s.device === 'tablet' ? 'max-w-[190px] sm:max-w-[220px]' : undefined}
              />
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex items-center justify-center gap-3 px-4">
        <Button variant="outline" size="icon" className="rounded-full" onClick={() => goTo(Math.max(0, active - 1))} disabled={active === 0} aria-label="Previous step">
          <ArrowRight className="h-4 w-4 rotate-180" />
        </Button>
        <Button asChild className="rounded-xl">
          <Link to="/auth?mode=signup">Open {SHOWCASE[active].badge}</Link>
        </Button>
        <Button variant="outline" size="icon" className="rounded-full" onClick={() => goTo(Math.min(last, active + 1))} disabled={active === last} aria-label="Next step">
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

const FEATURES = [
  { icon: Shield, title: 'Roles & approvals', desc: 'Control who can publish with role-based access and sign-off workflows.' },
  { icon: TrendingUp, title: 'Leads', desc: 'Capture leads from forms and WhatsApp, then track follow-ups in one place.' },
  { icon: Link2, title: 'Connections', desc: 'Link Facebook, Instagram, LinkedIn, and WhatsApp with secure OAuth.' },
  { icon: Users, title: 'Workspaces & teams', desc: 'Separate brands or clients with workspaces, seats, and permissions.' },
];

function FeaturesGrid() {
  return (
    <section id="features" className="py-section bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <Reveal>
          <SectionHeader
            label="Platform"
            title="Built for teams, not solo hacks"
            desc="Permissions, workspaces, and audit trails — without the enterprise software price tag."
            className="mb-14"
          />
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 70}>
              <div className="group rounded-xl border border-border/80 bg-card p-6 h-full transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:shadow-card hover:border-primary/30 motion-reduce:hover:translate-y-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 shadow-sm mb-4">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-2 text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/** One line under each plan name, so visitors can see who it's for at a glance. */
const PLAN_TAGLINES: Record<PublicPlan['key'], string> = {
  free: 'Try Mako with one brand',
  starter: 'For small teams posting every day',
  pro: 'For agencies and growing brands',
};

function PlanStat({ value, label, inverted }: { value: number | null; label: string; inverted?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="font-display text-lg font-bold tabular-nums leading-none">
        {value === null ? '∞' : value.toLocaleString('en-ZM')}
      </p>
      <p className={cn('mt-1 truncate text-[11px] uppercase tracking-wide', inverted ? 'text-background/60' : 'text-muted-foreground')}>
        {label}
      </p>
    </div>
  );
}

function PlanCard({ plan }: { plan: PublicPlan }) {
  const featured = plan.highlight;
  const free = plan.priceZmw === 0;
  return (
    <div
      className={cn(
        'relative flex h-full flex-col rounded-2xl border p-6 sm:p-7 transition-[transform,box-shadow] duration-200 motion-reduce:transition-none',
        featured
          ? // Raised: taller by the negative margins, so the extra padding doesn't squeeze the content.
          'border-foreground bg-foreground text-background shadow-2xl md:-my-4 md:h-[calc(100%+2rem)] md:py-9'
          : 'border-border/80 bg-card hover:-translate-y-1 hover:shadow-card motion-reduce:hover:translate-y-0',
      )}
    >
      {featured && (
        <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm">
          Most popular
        </span>
      )}

      {/* Headings get the page text colour globally; set it so the dark card's title shows. */}
      <h3 className={cn('font-display text-xl font-bold', featured && 'text-background')}>{plan.label}</h3>
      <p className={cn('mt-1 text-sm', featured ? 'text-background/70' : 'text-muted-foreground')}>
        {PLAN_TAGLINES[plan.key] ?? ''}
      </p>

      <div className="mt-6 flex items-baseline gap-1.5">
        {free ? (
          <span className="font-display text-5xl font-bold tracking-tight">Free</span>
        ) : (
          <>
            <span className={cn('text-sm font-semibold', featured ? 'text-background/70' : 'text-muted-foreground')}>ZMW</span>
            <span className="font-display text-5xl font-bold tracking-tight tabular-nums">{plan.priceZmw.toLocaleString('en-ZM')}</span>
            <span className={cn('text-sm', featured ? 'text-background/70' : 'text-muted-foreground')}>/month</span>
          </>
        )}
      </div>
      <p className={cn('mt-1 text-xs', featured ? 'text-background/60' : 'text-muted-foreground')}>
        {free ? 'No card needed, ever' : 'Billed monthly · turn off auto-renew anytime'}
      </p>

      <Button
        asChild
        size="lg"
        variant={featured ? 'default' : 'outline'}
        className={cn('mt-6 w-full shrink-0 rounded-xl', !featured && 'bg-transparent')}
      >
        <Link to="/auth?mode=signup">{free ? 'Start free' : `Choose ${plan.label}`}</Link>
      </Button>

      <div className={cn('mt-6 grid grid-cols-3 gap-3 border-y py-4', featured ? 'border-background/15' : 'border-border/70')}>
        <PlanStat value={plan.aiCallsLimit} label="AI / month" inverted={featured} />
        <PlanStat value={plan.seatLimit} label="Seats" inverted={featured} />
        <PlanStat value={plan.tenantLimit} label={plan.tenantLimit === 1 ? 'Workspace' : 'Workspaces'} inverted={featured} />
      </div>

      <ul className="mt-5 flex-1 space-y-3">
        {planFeatureBullets(plan).map((f) => (
          <li key={f} className={cn('flex gap-2.5 text-sm leading-snug', featured ? 'text-background/85' : 'text-body')}>
            <span className={cn(
              'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
              featured ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary',
            )}>
              <Check className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Pricing() {
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    plansApi
      .list()
      .then(setPlans)
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section id="pricing" className="py-section bg-card">
      <div className="mx-auto w-full max-w-[1100px] px-4 sm:px-6">
        <Reveal>
          <SectionHeader
            label="Pricing"
            title="Plans that scale with you"
            desc="Simple monthly pricing in Kwacha. Pay with mobile money."
            className="mb-14"
          />
        </Reveal>
        {loading ? (
          <div className="grid gap-6 md:grid-cols-3" aria-busy="true" aria-label="Loading plans">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[30rem] animate-pulse rounded-2xl border border-border/60 bg-muted/40" />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Plans couldn't load right now. <Link to="/auth?mode=signup" className="font-medium text-primary underline-offset-4 hover:underline">Start free</Link> and pick a plan later.
          </p>
        ) : (
          <div className="grid items-stretch gap-6 md:grid-cols-3 md:gap-5 lg:gap-6">
            {plans.map((p, i) => (
              <Reveal key={p.key} delay={i * 90} className="h-full">
                <PlanCard plan={p} />
              </Reveal>
            ))}
          </div>
        )}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><Smartphone className="h-3.5 w-3.5" /> Mobile money today, cards soon</span>
          <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> Upgrade anytime, or turn off auto-renew in Billing</span>
          <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Start on Free, no card needed</span>
        </div>
      </div>
    </section>
  );
}

const FAQS = [
  {
    id: "faq-1",
    question: "Do I need to be a marketing expert to use Mako?",
    answer: "Not at all! Mako's Brand Brain learns your business tone and automatically drafts professional, ready-to-post content. You just review and approve.",
    image: "/screenshots/mako-content-engine-desktop.webp",
    device: "desktop" as ScreenshotDevice,
    mock: <MockContentEngine />
  },
  {
    id: "faq-2",
    question: "Which social media platforms do you support?",
    answer: "You can currently connect and publish to Facebook, Instagram, X (Twitter), and LinkedIn. We automatically format your content for each platform.",
    image: "/screenshots/mako-publishing-desktop.webp",
    device: "desktop" as ScreenshotDevice,
    mock: <MockPublish />
  },
  {
    id: "faq-3",
    question: "Can I schedule posts in advance?",
    answer: "Yes, you can visually plan and schedule your posts weeks or months in advance using our interactive content calendar.",
    image: "/screenshots/mako-scheduler.webp",
    device: "tablet" as ScreenshotDevice,
    mock: <MockScheduler />
  },
  {
    id: "faq-4",
    question: "How do you handle multiple team members?",
    answer: "Mako includes role-based access control. You can have content creators draft posts while managers approve them before they go live.",
    image: "/screenshots/mako-dashboard-desktop.webp",
    device: "desktop" as ScreenshotDevice,
    mock: <MockBrandBrain />
  }
];

function FAQSection() {
  const [activeFaq, setActiveFaq] = useState("faq-1");

  return (
    <section id="faq" className="py-section bg-white">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6">
        <Reveal>
          <SectionHeader
            label="FAQ"
            title="Frequently asked questions"
            desc="Everything you need to know about getting started."
            className="mb-12"
          />
        </Reveal>
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
          <Reveal delay={100}>
            <Accordion
              type="single"
              value={activeFaq}
              onValueChange={(val) => val && setActiveFaq(val)}
              className="w-full"
            >
              {FAQS.map((faq) => (
                <AccordionItem key={faq.id} value={faq.id} className="border-border/60">
                  <AccordionTrigger className="text-left text-lg font-semibold hover:no-underline hover:text-primary transition-colors">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-base leading-relaxed">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
          
          {/* All screenshots stay mounted and cross-fade, so switching never reloads an image. */}
          <Reveal delay={200} className="hidden lg:grid sticky top-32 items-center">
            {FAQS.map((faq) => (
              <div
                key={faq.id}
                aria-hidden={faq.id !== activeFaq}
                className={cn(
                  '[grid-area:1/1] transition-opacity duration-300 ease-out motion-reduce:transition-none',
                  faq.id === activeFaq ? 'opacity-100' : 'opacity-0 pointer-events-none',
                )}
              >
                <ScreenshotFrame
                  src={faq.image}
                  alt={faq.question}
                  mock={faq.mock}
                  device={faq.device}
                />
              </div>
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="py-section px-4 bg-foreground text-background">
      <Reveal>
        <div className="w-full max-w-[1200px] mx-auto rounded-xl bg-foreground p-10 sm:p-12 text-center">
          <h2 className="font-display text-display-md sm:text-4xl font-extrabold tracking-tight text-primary">
            Start with a free account
          </h2>
          <p className="text-background/70 mt-4 text-lg max-w-lg mx-auto leading-relaxed">
            Set up your brand, connect a channel, and publish your first post. Most teams are up and running the same day.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
            <Button size="lg" asChild className="group min-h-12 h-12 px-8 rounded-xl transition-shadow duration-200 hover:shadow-lg hover:shadow-primary/20">
              <Link to="/auth?mode=signup">
                Create free account
                <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="min-h-12 h-12 px-8 rounded-xl border-background/40 bg-transparent text-background hover:bg-background/10">
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-section bg-foreground text-background">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 flex flex-col md:flex-row justify-between gap-8">
        <div>
          <Logo className="h-14 brightness-0 invert" />
          <p className="text-sm text-background/70 mt-3 max-w-xs leading-relaxed">
            Marketing workspace by {COMPANY.legalName}. Built in Zambia for teams across Africa.
          </p>
        </div>
        <div className="flex gap-8 text-sm text-background/70">
          <Link to="/download" className="hover:text-background">Android app</Link>
          <Link to="/privacy" className="hover:text-background">Privacy</Link>
          <Link to="/terms" className="hover:text-background">Terms</Link>
          <Link to="/data-deletion" className="hover:text-background">Data deletion</Link>
          <Link to="/auth" className="hover:text-background">Sign in</Link>
        </div>
      </div>
      <p className="text-center text-xs text-background/50 mt-8">© {new Date().getFullYear()} {COMPANY_BYLINE}</p>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <Hero />
      <GuestAdUnit slotId={import.meta.env.VITE_ADSENSE_SLOT_DISCOVER} className="px-4 py-6 sm:px-6" />
      <ProductShowcase />
      <GuestAdUnit slotId={import.meta.env.VITE_ADSENSE_SLOT_TRACK} className="px-4 py-6 sm:px-6" />
      <FeaturesGrid />
      <GuestAdUnit slotId={import.meta.env.VITE_ADSENSE_SLOT_ARTIST} className="px-4 py-6 sm:px-6" />
      <Pricing />
      <GuestAdUnit slotId={import.meta.env.VITE_ADSENSE_SLOT_GATE} className="px-4 py-6 sm:px-6" />
      <FAQSection />
      <FinalCTA />
      <Footer />
    </div>
  );
}
