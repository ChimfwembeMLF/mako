import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { plansApi, type PublicPlan } from '@/lib/api';
import { formatPriceZmw, planFeatureBullets } from '@/lib/plans';
import {
  Rocket, Brain, Pen, CalendarClock, BarChart3, Zap, CheckCircle2, ArrowRight,
  Star, Menu, X, ChevronDown, MessageSquareReply, Shield, Sparkles, Link2,
  TrendingUp, Users, Globe, Loader2,
} from 'lucide-react';
import {
  ScreenshotFrame,
  BrowserChrome,
  MockBrandBrain,
  MockContentEngine,
  MockPublish,
  MockScheduler,
  MockAnalytics,
  MockReplies,
} from '@/components/landing/ProductMocks';
import Logo from '@/components/Logo';

function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useInView();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(32px)',
        transition: `opacity 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

const SHOWCASE = [
  {
    id: 'brand-brain',
    badge: 'Brand Brain',
    title: 'Teach the AI your voice once',
    desc: 'Company profile, tone, banned words, USPs, and audience — every post stays on-brand automatically.',
    img: '/screenshots/brand-brain.png',
    mock: <MockBrandBrain />,
    icon: Brain,
    color: 'from-purple-500 to-indigo-600',
  },
  {
    id: 'content',
    badge: 'Content Engine',
    title: 'Generate platform-native copy in seconds',
    desc: 'One theme → Facebook, Instagram, LinkedIn, email, and ad copy — each adapted to channel trends and limits.',
    img: '/screenshots/content-engine.png',
    mock: <MockContentEngine />,
    icon: Pen,
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'publish',
    badge: 'Multi-Platform Publish',
    title: 'Preview, attach media, publish everywhere',
    desc: 'Per-platform carousel previews, AI-adapted copy, and attachments sent to each social API.',
    img: '/screenshots/publish.png',
    mock: <MockPublish />,
    icon: Globe,
    color: 'from-teal-500 to-emerald-500',
    reverse: true,
  },
  {
    id: 'scheduler',
    badge: 'Scheduler',
    title: 'Plan a month of content in minutes',
    desc: 'Drag posts onto your calendar, set optimal times, and let auto-publish handle the rest.',
    img: '/screenshots/scheduler.png',
    mock: <MockScheduler />,
    icon: CalendarClock,
    color: 'from-green-500 to-lime-500',
  },
  {
    id: 'analytics',
    badge: 'Analytics',
    title: 'See what works, double down',
    desc: 'Track reach, engagement, and leads across campaigns — optimize with data, not guesswork.',
    img: '/screenshots/analytics.png',
    mock: <MockAnalytics />,
    icon: BarChart3,
    color: 'from-pink-500 to-rose-500',
    reverse: true,
  },
  {
    id: 'replies',
    badge: 'AI Replies',
    title: 'Never miss a comment again',
    desc: 'Pull comments from published posts, auto-draft replies with AI, and send from one queue.',
    img: '/screenshots/replies.png',
    mock: <MockReplies />,
    icon: MessageSquareReply,
    color: 'from-orange-500 to-amber-500',
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
        <Link to="/" className="flex items-center gap-2.5 group">
         <Logo />
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          {[['#product', 'Product'], ['#features', 'Features'], ['#pricing', 'Pricing']].map(([href, label]) => (
            <a key={href} href={href} className="hover:text-foreground transition-colors">{label}</a>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild><Link to="/auth">Sign in</Link></Button>
          <Button size="sm" asChild className="gradient-primary border-0 text-white shadow-glow">
            <Link to="/auth?mode=signup">Start free <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
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
          <Button className="w-full gradient-primary border-0 text-white mt-2" asChild>
            <Link to="/auth?mode=signup">Start free</Link>
          </Button>
        </div>
      )}
    </header>
  );
}

function Hero() {
  const words = ['Facebook', 'Instagram', 'LinkedIn', 'Email', 'WhatsApp'];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % words.length), 2400);
    return () => clearInterval(t);
  }, [words.length]);

  return (
    <section className="relative min-h-[100svh] flex items-center pt-20 pb-16 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] rounded-full bg-primary/15 blur-[100px] animate-pulse" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full bg-violet-500/10 blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-8 text-center lg:text-left">
          <FadeIn>
            <Badge variant="outline" className="gap-1.5 px-3 py-1 border-primary/30 bg-primary/5">
              <Sparkles className="h-3 w-3 text-primary" />
              Grow Smarter, Sell Stronger · Powered by Mistral AI
            </Badge>
          </FadeIn>
          <FadeIn delay={80}>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-display leading-[1.08] tracking-tight">
              Your marketing on{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-violet-500 to-purple-600">
                autopilot
              </span>
              <br />
              for{' '}
              <span key={idx} className="inline-block text-primary animate-in fade-in slide-in-from-bottom-2 duration-500">
                {words[idx]}
              </span>
            </h1>
          </FadeIn>
          <FadeIn delay={160}>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Mako Co-pilot learns your brand, generates channel-perfect content, schedules posts, captures leads, and replies to comments — from one dashboard built for African businesses.
            </p>
          </FadeIn>
          <FadeIn delay={240}>
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Button size="lg" asChild className="gradient-primary border-0 text-white h-12 px-8 shadow-glow hover:opacity-95">
                <Link to="/auth?mode=signup">Start free — no card <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="h-12 px-8">
                <a href="#product">See the product <ChevronDown className="ml-1 h-4 w-4" /></a>
              </Button>
            </div>
          </FadeIn>
          <FadeIn delay={320}>
            <div className="flex flex-wrap gap-6 justify-center lg:justify-start text-sm">
              {[['500+', 'Brands'], ['2M+', 'Posts'], ['30s', 'Avg. generate']].map(([n, l]) => (
                <div key={l}><span className="font-bold text-lg">{n}</span> <span className="text-muted-foreground">{l}</span></div>
              ))}
            </div>
          </FadeIn>
        </div>

        <FadeIn delay={200} className="relative">
          <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-3xl blur-2xl opacity-60" />
          <ScreenshotFrame
            src="/screenshots/dashboard.png"
            alt="Mako Co-pilot dashboard"
            url="app.autopilot.co/dashboard"
            mock={
              <div className="p-4 grid grid-cols-2 gap-3 min-h-[320px]">
                {[Brain, Pen, CalendarClock, BarChart3].map((Icon, i) => (
                  <div key={i} className="rounded-xl border bg-card p-4 flex flex-col gap-2 hover:border-primary/40 transition-colors">
                    <Icon className="h-5 w-5 text-primary" />
                    <span className="text-xs font-medium">{['Brand Brain', 'Content', 'Scheduler', 'Analytics'][i]}</span>
                  </div>
                ))}
              </div>
            }
            className="relative animate-[float_6s_ease-in-out_infinite]"
          />
        </FadeIn>
      </div>
      <style>{`@keyframes float { 0%,100%{transform:perspective(1200px) rotateX(2deg) translateY(0)} 50%{transform:perspective(1200px) rotateX(2deg) translateY(-8px)} }`}</style>
    </section>
  );
}

function ProductShowcase() {
  return (
    <section id="product" className="py-24 space-y-32">
      {SHOWCASE.map((s, i) => (
        <div key={s.id} className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className={`grid lg:grid-cols-2 gap-12 lg:gap-16 items-center ${s.reverse ? 'lg:[direction:rtl]' : ''}`}>
            <FadeIn delay={i * 40} className={`space-y-5 ${s.reverse ? 'lg:[direction:ltr]' : ''}`}>
              <Badge variant="secondary" className="gap-1"><s.icon className="h-3 w-3" />{s.badge}</Badge>
              <h2 className="text-3xl sm:text-4xl font-bold font-display leading-tight">{s.title}</h2>
              <p className="text-muted-foreground text-lg leading-relaxed">{s.desc}</p>
              <Button variant="outline" asChild className="rounded-full">
                <Link to="/auth?mode=signup">Try {s.badge} <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </FadeIn>
            <FadeIn delay={i * 40 + 100} className={s.reverse ? 'lg:[direction:ltr]' : ''}>
              <ScreenshotFrame src={s.img} alt={s.title} mock={s.mock} url={`app.autopilot.co/${s.id}`} />
            </FadeIn>
          </div>
        </div>
      ))}
    </section>
  );
}

const FEATURES = [
  { icon: Shield, title: 'RBAC & Approvals', desc: 'Roles, maker-checker workflows, audit logs.' },
  { icon: TrendingUp, title: 'Lead Agent', desc: 'Capture, score, and follow up on leads automatically.' },
  { icon: Link2, title: 'Publisher Connect', desc: 'OAuth to Facebook, Instagram, LinkedIn, X.' },
  { icon: Users, title: 'Multi-tenant Teams', desc: 'Workspaces, seats, and permissions per brand.' },
];

function FeaturesGrid() {
  return (
    <section id="features" className="py-24 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <FadeIn>
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold font-display">Built for teams that ship</h2>
            <p className="text-muted-foreground mt-3 max-w-lg mx-auto">Enterprise-grade controls without enterprise complexity.</p>
          </div>
        </FadeIn>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((f, i) => (
            <FadeIn key={f.title} delay={i * 60}>
              <div className="rounded-2xl border bg-card p-6 h-full hover:shadow-lg hover:border-primary/30 transition-all duration-300">
                <f.icon className="h-8 w-8 text-primary mb-4" />
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            </FadeIn>
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
    <section id="pricing" className="py-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <FadeIn>
          <h2 className="text-3xl sm:text-4xl font-bold font-display text-center mb-12">Simple pricing</h2>
        </FadeIn>
        {loading ? (
          <div className="flex justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading plans…
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((p, i) => (
              <FadeIn key={p.key} delay={i * 80}>
                <div className={`rounded-2xl border p-6 h-full flex flex-col ${p.highlight ? 'border-primary ring-2 ring-primary/20 bg-primary/5 scale-[1.02]' : 'bg-card'}`}>
                  <h3 className="font-bold text-xl">{p.label}</h3>
                  <p className="text-3xl font-bold mt-2">{formatPriceZmw(p.priceZmw)}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                  <ul className="space-y-2 mt-6 flex-1">
                    {planFeatureBullets(p).map((f) => (
                      <li key={f} className="flex gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />{f}</li>
                    ))}
                  </ul>
                  <Button className={`mt-6 w-full ${p.highlight ? 'gradient-primary border-0 text-white' : ''}`} variant={p.highlight ? 'default' : 'outline'} asChild>
                    <Link to="/auth?mode=signup">Get started</Link>
                  </Button>
                </div>
              </FadeIn>
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
    <section className="py-24 px-4">
      <FadeIn>
        <div className="max-w-4xl mx-auto rounded-3xl gradient-primary p-12 text-center text-white shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgZmlsbD0ibm9uZSIgZmlsbC1vcGFjaXR5PSIwLjA4Ij48cGF0aCBkPSJNMzYgMzRoLTJWMGg2djM0aC00ek0zNiAzNGgtMlYwaC02djM0aDQuNXoiLz48L2c+PC9zdmc+')] opacity-40" />
          <Zap className="h-12 w-12 mx-auto mb-4 opacity-90 relative" />
          <h2 className="text-3xl sm:text-4xl font-bold font-display relative">Ready to put Mako Co-pilot to work?</h2>
          <p className="text-white/85 mt-4 text-lg max-w-xl mx-auto relative">Join brands across Africa generating consistent, on-brand content every day.</p>
          <Button size="lg" className="mt-8 bg-white text-primary hover:bg-white/90 relative" asChild>
            <Link to="/auth?mode=signup">Start free today <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </FadeIn>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t py-12 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row justify-between gap-8">
        <div>
          <Logo />
          <p className="text-sm text-muted-foreground mt-2 max-w-xs">AI marketing autopilot by Tekrem Innvation Solutions. Built in Zambia.</p>
        </div>
        <div className="flex gap-8 text-sm text-muted-foreground">
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
          <Link to="/data-deletion" className="hover:text-foreground">Data deletion</Link>
          <Link to="/auth" className="hover:text-foreground">Sign in</Link>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground mt-8">© {new Date().getFullYear()} Mako Co-pilot · Tekrem Innvation Solutions</p>
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
