import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { plansApi, type PublicPlan } from '@/lib/api';
import { formatPriceZmw, planFeatureBullets } from '@/lib/plans';
import {
  Brain, Pen, CalendarClock, BarChart3, CheckCircle2, ArrowRight,
  Menu, X, MessageSquareReply, Shield, Link2,
  TrendingUp, Users, Globe, Loader2,
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

type RevealVariant = 'up' | 'left' | 'right' | 'scale';

const REVEAL_HIDDEN: Record<RevealVariant, string> = {
  up: 'translateY(36px)',
  left: 'translateX(-44px)',
  right: 'translateX(44px)',
  scale: 'translateY(20px) scale(0.94)',
};

function Reveal({
  children,
  delay = 0,
  className = '',
  variant = 'up',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  variant?: RevealVariant;
}) {
  const { ref, visible } = useInView(0.14);
  return (
    <div
      ref={ref}
      className={cn(
        'motion-reduce:opacity-100 motion-reduce:transform-none',
        className,
      )}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : REVEAL_HIDDEN[variant],
        transition: `opacity 0.75s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, transform 0.85s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
      }}
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
  reverse?: boolean;
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
    reverse: true,
  },
  {
    id: 'scheduler',
    badge: 'Scheduler',
    title: 'Keep your calendar full',
    desc: 'Queue posts on a visual calendar and publish on the dates and times you choose.',
    img: '/screenshots/mako-scheduler.webp',
    mock: <MockScheduler />,
    icon: CalendarClock,
    device: 'desktop',
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
    reverse: true,
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
    <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-card/95 backdrop-blur border-b border-border' : 'bg-transparent'}`}>
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center">
          <Logo className="h-9" />
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-nav-link text-foreground">
          {[['#product', 'Product'], ['#features', 'Features'], ['#pricing', 'Pricing']].map(([href, label]) => (
            <a key={href} href={href} className="hover:opacity-70 transition-opacity">{label}</a>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild><Link to="/auth">Sign in</Link></Button>
          <Button size="sm" asChild className="rounded-xl min-h-12 h-12 px-5">
            <Link to="/auth?mode=signup">Get started <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
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
          <Button className="w-full mt-2 min-h-12 rounded-xl" asChild>
            <Link to="/auth?mode=signup">Get started</Link>
          </Button>
        </div>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section className="relative min-h-[92svh] flex items-center pt-24 pb-section overflow-hidden bg-background">
      <div className="absolute inset-0 landing-glow pointer-events-none opacity-60" aria-hidden />
      <div className="relative max-w-[1200px] mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center w-full">
        <div className="space-y-7 text-center lg:text-left">
          <Reveal>
            <p className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">
              Mako
            </p>
          </Reveal>

          <Reveal delay={80} variant="up">
            <h1 className="font-display text-display-xl text-foreground">
              Your brand voice.
              <br />
              Every channel.
              <br />
              One workspace.
            </h1>
          </Reveal>

          <Reveal delay={140} variant="up">
            <p className="text-lg text-body max-w-lg mx-auto lg:mx-0 leading-relaxed">
              Plan content, publish to social, reply to comments, and follow up on leads — without switching between a dozen tabs.
            </p>
          </Reveal>

          <Reveal delay={280} variant="up">
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start pt-1">
              <Button
                size="lg"
                asChild
                className="min-h-12 h-12 px-8 rounded-xl"
              >
                <Link to="/auth?mode=signup">
                  Get started free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="secondary" asChild className="min-h-12 h-12 px-8 rounded-xl">
                <a href="#product">See how it works</a>
              </Button>
            </div>
          </Reveal>

          <Reveal delay={360} variant="up">
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

        <Reveal delay={180} variant="scale" className="relative lg:pl-4">
          <div className="rounded-xl bg-card p-3 sm:p-4">
            <ScreenshotFrame
              src="/screenshots/mako-dashboard-desktop.webp"
              alt="Mako dashboard — content, scheduling, and analytics"
              device="desktop"
              float
              mock={<div className="min-h-[300px] rounded-xl border border-dashed border-border/60 animate-pulse" />}
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function ProductShowcase() {
  return (
    <section id="product" className="py-section bg-card border-t border-border/40">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 mb-20">
        <Reveal>
          <SectionHeader
            label="Product"
            title="From brief to published post"
            desc="Six tools that share the same brand context — so you are not copying and pasting between apps."
          />
        </Reveal>
      </div>
      <div className="space-y-24">
        {SHOWCASE.map((s, i) => (
          <div key={s.id} className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className={`grid lg:grid-cols-2 gap-12 lg:gap-16 items-center ${s.reverse ? 'lg:[direction:rtl]' : ''}`}>
              <Reveal
                delay={i * 50}
                variant={s.reverse ? 'right' : 'left'}
                className={`space-y-5 ${s.reverse ? 'lg:[direction:ltr]' : ''}`}
              >
                <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                  <s.icon className="h-3.5 w-3.5" />
                  {s.badge}
                </p>
                <h3 className="text-2xl sm:text-3xl font-bold font-display leading-tight tracking-tight">{s.title}</h3>
                <p className="text-muted-foreground text-base leading-relaxed max-w-md">{s.desc}</p>
                <Button variant="outline" asChild className="rounded-xl transition-transform duration-300 hover:translate-x-0.5">
                  <Link to="/auth?mode=signup">
                    Open {s.badge}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </Reveal>
              <Reveal
                delay={i * 50 + 120}
                variant={s.reverse ? 'left' : 'right'}
                className={cn(
                  s.reverse ? 'lg:[direction:ltr]' : '',
                  s.device !== 'desktop' && 'flex justify-center lg:justify-center',
                )}
              >
                <ScreenshotFrame
                  src={s.img}
                  alt={s.title}
                  mock={s.mock}
                  device={s.device}
                />
              </Reveal>
            </div>
          </div>
        ))}
      </div>
    </section>
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
    <section id="features" className="py-section bg-background border-t border-border/40">
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
            <Reveal key={f.title} delay={i * 70} variant="up">
              <div className="rounded-xl border border-border/80 bg-card p-6 h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-card hover:border-primary/20">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 mb-4">
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
    <section id="pricing" className="py-section bg-card border-t border-border/40">
      <div className="w-full px-4 sm:px-6">
        <Reveal>
          <SectionHeader
            label="Pricing"
            title="Plans that scale with you"
            desc="Pay monthly in ZMW. Mobile money supported today."
            className="mb-12"
          />
        </Reveal>
        {loading ? (
          <div className="flex justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading plans…
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((p, i) => (
              <Reveal key={p.key} delay={i * 90} variant="scale">
                <div className={cn(
                  'rounded-xl border p-6 h-full flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-card',
                  p.highlight ? 'border-primary bg-primary/[0.04] ring-1 ring-primary/20' : 'border-border/80 bg-card',
                )}>
                  {p.highlight && (
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">Most popular</p>
                  )}
                  <h3 className="font-bold text-xl">{p.label}</h3>
                  <p className="text-3xl font-bold mt-2 tracking-tight">{formatPriceZmw(p.priceZmw)}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                  <ul className="space-y-2.5 mt-6 flex-1">
                    {planFeatureBullets(p).map((f) => (
                      <li key={f} className="flex gap-2 text-sm text-muted-foreground leading-snug">
                        <CheckCircle2 className="h-4 w-4 text-positive-deep shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button className={`mt-6 w-full rounded-xl ${p.highlight ? '' : ''}`} variant={p.highlight ? 'default' : 'outline'} asChild>
                    <Link to="/auth?mode=signup">Get started</Link>
                  </Button>
                </div>
              </Reveal>
            ))}
          </div>
        )}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Mobile money available today · Card payments coming soon
        </p>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="py-section px-4 bg-foreground text-background">
      <Reveal variant="scale">
        <div className="w-full max-w-[1200px] mx-auto rounded-xl bg-foreground p-10 sm:p-12 text-center">
          <h2 className="font-display text-display-md sm:text-4xl font-extrabold tracking-tight text-primary">
            Start with a free account
          </h2>
          <p className="text-background/70 mt-4 text-lg max-w-lg mx-auto leading-relaxed">
            Set up your brand, connect a channel, and publish your first post. Most teams are up and running the same day.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
            <Button size="lg" asChild className="min-h-12 h-12 px-8 rounded-xl">
              <Link to="/auth?mode=signup">
                Create free account
                <ArrowRight className="ml-2 h-4 w-4" />
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
            Marketing workspace by Tekrem Innovation Solutions. Built in Zambia for teams across Africa.
          </p>
        </div>
        <div className="flex gap-8 text-sm text-background/70">
          <Link to="/privacy" className="hover:text-background">Privacy</Link>
          <Link to="/terms" className="hover:text-background">Terms</Link>
          <Link to="/data-deletion" className="hover:text-background">Data deletion</Link>
          <Link to="/auth" className="hover:text-background">Sign in</Link>
        </div>
      </div>
      <p className="text-center text-xs text-background/50 mt-8">© {new Date().getFullYear()} Mako · Tekrem Innovation Solutions</p>
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
      <FinalCTA />
      <Footer />
    </div>
  );
}
