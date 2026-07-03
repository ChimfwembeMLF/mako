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
      <h2 className="text-3xl sm:text-4xl font-bold font-display tracking-tight">{title}</h2>
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
    <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${scrolled ? 'bg-background/85 backdrop-blur-xl border-b shadow-sm' : ''}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center">
          <Logo className="h-9" />
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          {[['#product', 'Product'], ['#features', 'Features'], ['#pricing', 'Pricing']].map(([href, label]) => (
            <a key={href} href={href} className="hover:text-foreground transition-colors">{label}</a>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild><Link to="/auth">Sign in</Link></Button>
          <Button size="sm" asChild className="gradient-primary border-0 text-white rounded-lg shadow-card">
            <Link to="/auth?mode=signup">Get started <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
          </Button>
        </div>
        <button type="button" className="md:hidden p-2" onClick={() => setOpen((o) => !o)} aria-label="Menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t bg-background/95 backdrop-blur px-4 pb-4 space-y-2">
          {[['#product', 'Product'], ['#features', 'Features'], ['#pricing', 'Pricing']].map(([href, label]) => (
            <a key={href} href={href} className="block py-2 text-sm" onClick={() => setOpen(false)}>{label}</a>
          ))}
          <Button className="w-full gradient-primary border-0 text-white mt-2 rounded-lg" asChild>
            <Link to="/auth?mode=signup">Get started</Link>
          </Button>
        </div>
      )}
    </header>
  );
}

function Hero() {
  const platforms = ['Facebook', 'Instagram', 'LinkedIn', 'WhatsApp', 'Email'];

  return (
    <section className="relative min-h-[92svh] flex items-center pt-20 pb-20 overflow-hidden border-b border-border/50">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 right-[-10%] w-[min(50vw,480px)] h-[min(50vw,480px)] rounded-full bg-primary/[0.07] blur-3xl" />
        <div className="absolute bottom-[-20%] left-[-5%] w-[min(42vw,400px)] h-[min(42vw,400px)] rounded-full bg-secondary/[0.05] blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div className="space-y-7 text-center lg:text-left">
          <Reveal>
            <p className="inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <span className="h-px w-8 bg-primary/60 hidden sm:block" />
              Marketing workspace
              <span className="h-px w-8 bg-primary/60 hidden sm:block" />
            </p>
          </Reveal>

          <Reveal delay={80} variant="up">
            <h1 className="text-[2.35rem] sm:text-5xl lg:text-[3.2rem] font-bold font-display leading-[1.06] tracking-[-0.025em]">
              Your brand voice.
              <br />
              <span className="text-primary">Every channel.</span>
              <br />
              One dashboard.
            </h1>
          </Reveal>

          <Reveal delay={140} variant="up">
            <p className="text-lg text-muted-foreground max-w-lg mx-auto lg:mx-0 leading-relaxed">
              Plan content, publish to social, reply to comments, and follow up on leads — without switching between a dozen tabs.
            </p>
          </Reveal>

          <Reveal delay={200} variant="up">
            <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
              {platforms.map((platform, i) => (
                <span
                  key={platform}
                  className="rounded-full border border-border/80 bg-background/90 px-3 py-1 text-xs font-medium text-muted-foreground motion-reduce:opacity-100 motion-reduce:translate-y-0 animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both"
                  style={{ animationDelay: `${240 + i * 60}ms` }}
                >
                  {platform}
                </span>
              ))}
            </div>
          </Reveal>

          <Reveal delay={280} variant="up">
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start pt-1">
              <Button
                size="lg"
                asChild
                className="gradient-primary border-0 text-white h-12 px-8 rounded-xl shadow-card hover:opacity-95"
              >
                <Link to="/auth?mode=signup">
                  Get started free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="h-12 px-8 rounded-xl bg-background/80">
                <a href="#product">See how it works</a>
              </Button>
            </div>
          </Reveal>

          <Reveal delay={360} variant="up">
            <ul className="flex flex-col sm:flex-row flex-wrap gap-x-6 gap-y-2 justify-center lg:justify-start text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-accent shrink-0" />
                No credit card required
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-accent shrink-0" />
                Mobile money billing
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-accent shrink-0" />
                Built in Zambia
              </li>
            </ul>
          </Reveal>
        </div>

        <Reveal delay={180} variant="scale" className="relative lg:pl-4">
          <ScreenshotFrame
            src="/screenshots/mako-dashboard-desktop.webp"
            alt="Mako dashboard — content, scheduling, and analytics"
            device="desktop"
            float
            mock={<div className="min-h-[300px] rounded-2xl border border-dashed border-border/60 animate-pulse" />}
          />
        </Reveal>
      </div>
    </section>
  );
}

function ProductShowcase() {
  return (
    <section id="product" className="py-24 border-t border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-20">
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
                <Button variant="outline" asChild className="rounded-lg transition-transform duration-300 hover:translate-x-0.5">
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
  { icon: TrendingUp, title: 'Lead Agent', desc: 'Capture leads from forms and WhatsApp, then track follow-ups in one place.' },
  { icon: Link2, title: 'Publisher Connect', desc: 'Link Facebook, Instagram, LinkedIn, and WhatsApp with secure OAuth.' },
  { icon: Users, title: 'Workspaces & teams', desc: 'Separate brands or clients with workspaces, seats, and permissions.' },
];

function FeaturesGrid() {
  return (
    <section id="features" className="py-24 bg-muted/25 border-t border-border/50">
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
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mb-4">
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
    <section id="pricing" className="py-24 border-t border-border/50">
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
                        <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button className={`mt-6 w-full rounded-lg ${p.highlight ? 'gradient-primary border-0 text-white' : ''}`} variant={p.highlight ? 'default' : 'outline'} asChild>
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
    <section className="py-24 px-4 border-t border-border/50">
      <Reveal variant="scale">
        <div className="w-full rounded-2xl border border-border/80 bg-card p-10 sm:p-12 text-center shadow-card transition-shadow duration-500 hover:shadow-glow">
          <h2 className="text-3xl sm:text-4xl font-bold font-display tracking-tight">Start with a free account</h2>
          <p className="text-muted-foreground mt-4 text-lg max-w-lg mx-auto leading-relaxed">
            Set up your brand, connect a channel, and publish your first post. Most teams are up and running the same day.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
            <Button size="lg" asChild className="gradient-primary border-0 text-white h-12 px-8 rounded-xl shadow-card">
              <Link to="/auth?mode=signup">
                Create free account
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="h-12 px-8 rounded-xl">
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
    <footer className="border-t border-border/50 py-12 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row justify-between gap-8">
        <div>
          <Logo className="h-14" />
          <p className="text-sm text-muted-foreground mt-3 max-w-xs leading-relaxed">
            Marketing workspace by Tekrem Innovation Solutions. Built in Zambia for teams across Africa.
          </p>
        </div>
        <div className="flex gap-8 text-sm text-muted-foreground">
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
          <Link to="/data-deletion" className="hover:text-foreground">Data deletion</Link>
          <Link to="/auth" className="hover:text-foreground">Sign in</Link>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground mt-8">© {new Date().getFullYear()} Mako · Tekrem Innovation Solutions</p>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <Hero />
      <ProductShowcase />
      <FeaturesGrid />
      <Pricing />
      <FinalCTA />
      <Footer />
    </div>
  );
}
