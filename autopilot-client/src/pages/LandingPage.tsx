import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Rocket, Brain, Pen, CalendarClock, BarChart3, Users, Zap,
  CheckCircle2, ArrowRight, Star, Menu, X, ChevronDown,
  MessageSquareReply, Image, Shield, Globe, TrendingUp, Sparkles,
} from 'lucide-react';

/* ── tiny animation helpers ───────────────────────────────────── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useInView();
  return (
    <div ref={ref} className={className}
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(28px)', transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms` }}>
      {children}
    </div>
  );
}

/* ── Nav ──────────────────────────────────────────────────────── */
function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);
  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-background/80 backdrop-blur-md border-b' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
            <Rocket className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-lg font-display">BrandPilot</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          {[['#features','Features'],['#how','How it works'],['#pricing','Pricing']].map(([href,label])=>(
            <a key={href} href={href} className="hover:text-foreground transition-colors">{label}</a>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild><Link to="/auth">Sign in</Link></Button>
          <Button size="sm" asChild className="gradient-primary border-0 text-white">
            <Link to="/auth?mode=signup">Start free →</Link>
          </Button>
        </div>
        <button className="md:hidden p-2" onClick={() => setOpen(o => !o)}>{open ? <X className="h-5 w-5"/> : <Menu className="h-5 w-5"/>}</button>
      </div>
      {open && (
        <div className="md:hidden bg-background/95 backdrop-blur border-b px-4 pb-4 space-y-3">
          {[['#features','Features'],['#how','How it works'],['#pricing','Pricing']].map(([href,label])=>(
            <a key={href} href={href} className="block py-2 text-sm text-muted-foreground hover:text-foreground" onClick={()=>setOpen(false)}>{label}</a>
          ))}
          <div className="flex flex-col gap-2 pt-2">
            <Button variant="outline" asChild><Link to="/auth">Sign in</Link></Button>
            <Button asChild className="gradient-primary border-0 text-white"><Link to="/auth?mode=signup">Start free</Link></Button>
          </div>
        </div>
      )}
    </header>
  );
}

/* ── Hero ─────────────────────────────────────────────────────── */
function Hero() {
  const words = ['Facebook','LinkedIn','Instagram','WhatsApp','Email','Ad Copy'];
  const [wordIdx, setWordIdx] = useState(0);
  useEffect(() => { const t = setInterval(() => setWordIdx(i => (i+1)%words.length), 2200); return ()=>clearInterval(t); }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background pt-16">
      {/* Animated blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full bg-primary/10 blur-3xl animate-pulse" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-purple-500/10 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-indigo-500/5 blur-2xl animate-pulse" style={{ animationDelay: '2s' }} />
        {/* Floating dots grid */}
        {Array.from({length:25}).map((_,i)=>(
          <div key={i} className="absolute w-1 h-1 rounded-full bg-primary/20"
            style={{ left:`${(i%5)*22+5}%`, top:`${Math.floor(i/5)*22+5}%`, animationDelay:`${i*0.3}s` }} />
        ))}
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-8">
        <FadeIn>
          <Badge variant="outline" className="gap-1.5 px-3 py-1 text-xs border-primary/30 bg-primary/5">
            <Sparkles className="h-3 w-3 text-primary" />
            Powered by Mistral AI · Built for Africa
          </Badge>
        </FadeIn>

        <FadeIn delay={100}>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold font-display leading-tight tracking-tight">
            AI content for{' '}
            <span className="relative inline-block">
              <span
                key={wordIdx}
                className="text-transparent bg-clip-text gradient-primary"
                style={{ animation: 'fadeSlideIn 0.4s ease forwards' }}>
                {words[wordIdx]}
              </span>
            </span>
            <br />
            in <span className="text-transparent bg-clip-text gradient-primary">30 seconds.</span>
          </h1>
        </FadeIn>

        <FadeIn delay={200}>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            BrandPilot learns your brand voice and generates perfectly-formatted, on-brand content
            for every platform — then schedules and publishes it for you.
          </p>
        </FadeIn>

        <FadeIn delay={300}>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" asChild className="gradient-primary border-0 text-white h-12 px-8 text-base shadow-glow">
              <Link to="/auth?mode=signup">Start free — no credit card <ArrowRight className="ml-2 h-4 w-4"/></Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="h-12 px-8 text-base">
              <a href="#how">See how it works <ChevronDown className="ml-1 h-4 w-4"/></a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">Free plan · 10 AI generations/month · No card required</p>
        </FadeIn>

        {/* Social proof strip */}
        <FadeIn delay={400}>
          <div className="flex flex-wrap items-center justify-center gap-6 pt-4">
            {[['500+','Active brands'],['2M+','Posts generated'],['98%','Satisfaction rate'],['30s','Avg generation time']].map(([num,label])=>(
              <div key={label} className="text-center">
                <div className="text-2xl font-bold text-foreground">{num}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </FadeIn>

        {/* Dashboard preview */}
        <FadeIn delay={500}>
          <div className="relative mx-auto max-w-4xl mt-4">
            <div className="rounded-2xl border bg-card shadow-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/50">
                <div className="flex gap-1.5"><div className="h-3 w-3 rounded-full bg-red-400"/><div className="h-3 w-3 rounded-full bg-amber-400"/><div className="h-3 w-3 rounded-full bg-green-400"/></div>
                <div className="flex-1 h-5 rounded bg-muted mx-8 text-xs flex items-center justify-center text-muted-foreground">app.brandpilot.co</div>
              </div>
              <div className="p-4 grid grid-cols-3 gap-3 min-h-[220px] bg-background">
                {[{icon:Brain,label:'Brand Brain',color:'bg-purple-500/10 text-purple-500'},{icon:Pen,label:'Content Engine',color:'bg-blue-500/10 text-blue-500'},{icon:CalendarClock,label:'Scheduler',color:'bg-green-500/10 text-green-500'},{icon:MessageSquareReply,label:'Replies',color:'bg-orange-500/10 text-orange-500'},{icon:BarChart3,label:'Analytics',color:'bg-pink-500/10 text-pink-500'},{icon:Users,label:'Team',color:'bg-indigo-500/10 text-indigo-500'}].map(({icon:Icon,label,color})=>(
                  <div key={label} className="rounded-xl border bg-card p-4 flex flex-col items-center gap-2 hover:border-primary/40 transition-colors cursor-pointer">
                    <div className={`h-10 w-10 rounded-lg ${color} flex items-center justify-center`}><Icon className="h-5 w-5"/></div>
                    <span className="text-xs font-medium text-center">{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">↓ Keep scrolling</div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ── Features ─────────────────────────────────────────────────── */
const FEATURES = [
  { icon: Brain,              color: 'from-purple-500 to-indigo-500',  title: 'Brand Brain',          desc: 'Train the AI on your company name, tone, banned words, USPs, and target audience. One setup — every piece of content is perfectly on-brand forever.' },
  { icon: Pen,                color: 'from-blue-500 to-cyan-500',      title: 'Content Engine',        desc: 'Generate Facebook posts, LinkedIn articles, Instagram captions, tweet threads, email copy, and ad text in under 30 seconds.' },
  { icon: CalendarClock,      color: 'from-green-500 to-emerald-500',  title: 'Smart Scheduler',       desc: 'Drag-and-drop your content calendar. Set optimal posting times per platform. Bulk-schedule a month of content in minutes.' },
  { icon: MessageSquareReply, color: 'from-orange-500 to-amber-500',   title: 'AI Reply Engine',       desc: 'Auto-detect comments by sentiment and keywords, draft AI replies, and manage your reply queue — all in one place.' },
  { icon: Image,              color: 'from-pink-500 to-rose-500',      title: 'Media Library',         desc: 'Upload, organise, and reuse brand assets across all your content. Integrated picker inside the content editor.' },
  { icon: Shield,             color: 'from-slate-500 to-zinc-600',     title: 'RBAC & Approvals',      desc: 'Full role-based access control, maker-checker approval workflows, per-user permission overrides, and immutable audit logs.' },
  { icon: TrendingUp,         color: 'from-violet-500 to-purple-600',  title: 'Lead Agent',            desc: 'Capture and classify leads from your contact form, WhatsApp opt-ins, and web forms. Auto-score hot/warm/cold.' },
  { icon: Globe,              color: 'from-teal-500 to-green-500',     title: 'Multi-Platform Publisher', desc: 'Connect Facebook, LinkedIn, Instagram, Twitter/X, and WhatsApp. Publish to all channels from one dashboard.' },
];

function Features() {
  return (
    <section id="features" className="py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <FadeIn>
          <div className="text-center space-y-3 mb-16">
            <Badge variant="outline" className="text-xs">Features</Badge>
            <h2 className="text-4xl font-bold font-display">Everything your marketing team needs</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">One platform that replaces five tools. Stop switching tabs.</p>
          </div>
        </FadeIn>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map(({ icon: Icon, color, title, desc }, i) => (
            <FadeIn key={title} delay={i * 60}>
              <div className="group rounded-2xl border bg-card p-6 space-y-4 hover:border-primary/40 hover:shadow-lg transition-all duration-300 h-full">
                <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1.5">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── How it works ─────────────────────────────────────────────── */
function HowItWorks() {
  const steps = [
    { n:'01', title:'Set up your Brand Brain', desc:'Tell the AI about your company, tone, audience, and what topics are off-limits. Takes 5 minutes.' },
    { n:'02', title:'Choose a platform & theme', desc:'Pick Facebook, LinkedIn, Instagram, or any other channel. Drop in a campaign theme or let the AI decide.' },
    { n:'03', title:'Review & publish', desc:'Your perfectly-formatted content is ready in seconds. Edit, approve, schedule, or publish instantly.' },
  ];
  return (
    <section id="how" className="py-24 bg-muted/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <FadeIn>
          <div className="text-center space-y-3 mb-16">
            <Badge variant="outline" className="text-xs">How it works</Badge>
            <h2 className="text-4xl font-bold font-display">From brand brief to published post in 3 steps</h2>
          </div>
        </FadeIn>
        <div className="relative">
          {/* connector line */}
          <div className="absolute left-8 top-12 bottom-12 w-0.5 bg-gradient-to-b from-primary to-purple-500 hidden md:block" />
          <div className="space-y-10">
            {steps.map(({ n, title, desc }, i) => (
              <FadeIn key={n} delay={i * 150}>
                <div className="flex gap-8 items-start">
                  <div className="shrink-0 h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center text-white font-bold text-lg shadow-glow">
                    {n}
                  </div>
                  <div className="pt-3">
                    <h3 className="text-xl font-semibold mb-2">{title}</h3>
                    <p className="text-muted-foreground leading-relaxed max-w-xl">{desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Testimonials ─────────────────────────────────────────────── */
const TESTIMONIALS = [
  { name:'Thandiwe M.', role:'Marketing Manager · Lusaka', text:'We went from spending 3 hours writing content to 20 minutes reviewing it. The Brand Brain actually understands our tone.', stars:5 },
  { name:'Chanda K.', role:'Founder · AgriTech Startup', text:'The approval workflow is exactly what we needed for compliance. Nothing goes live without two pairs of eyes.', stars:5 },
  { name:'Gift N.', role:'Digital Agency Owner', text:'Running 6 client brands from one dashboard. The multi-tenant setup is incredibly well thought out.', stars:5 },
];

function Testimonials() {
  return (
    <section className="py-24 bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <FadeIn>
          <div className="text-center space-y-3 mb-16">
            <Badge variant="outline" className="text-xs">Testimonials</Badge>
            <h2 className="text-4xl font-bold font-display">Trusted by brands across Africa</h2>
          </div>
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map(({ name, role, text, stars }, i) => (
            <FadeIn key={name} delay={i * 100}>
              <div className="rounded-2xl border bg-card p-6 space-y-4 hover:border-primary/30 transition-colors">
                <div className="flex gap-0.5">{Array.from({length:stars}).map((_,j)=><Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400"/>)}</div>
                <p className="text-sm text-muted-foreground leading-relaxed">"{text}"</p>
                <div>
                  <p className="font-semibold text-sm">{name}</p>
                  <p className="text-xs text-muted-foreground">{role}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Pricing ──────────────────────────────────────────────────── */
const PLANS = [
  { key:'free',    name:'Free',    price:'ZMW 0',   period:'forever',   seats:2,    ai:10,    tenants:1,  features:['10 AI generations/month','2 team seats','1 workspace','Basic content types','Media library'], cta:'Get started free', highlight:false },
  { key:'starter', name:'Starter', price:'ZMW 375', period:'per month', seats:10,   ai:100,   tenants:3,  features:['100 AI generations/month','10 team seats','3 workspaces','All platforms','Maker-checker approvals','Audit logs','Reply queue'], cta:'Start Starter plan', highlight:true },
  { key:'pro',     name:'Pro',     price:'ZMW 875', period:'per month', seats:'∞',  ai:'∞',   tenants:'∞',features:['Unlimited AI generations','Unlimited seats','Unlimited workspaces','Priority AI model','Data exports','API access','Dedicated support'], cta:'Go Pro', highlight:false },
];

function Pricing() {
  return (
    <section id="pricing" className="py-24 bg-muted/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <FadeIn>
          <div className="text-center space-y-3 mb-16">
            <Badge variant="outline" className="text-xs">Pricing</Badge>
            <h2 className="text-4xl font-bold font-display">Simple, transparent pricing</h2>
            <p className="text-muted-foreground">Start free, upgrade when you're ready. No hidden fees.</p>
          </div>
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {PLANS.map(({ key, name, price, period, seats, ai, tenants, features, cta, highlight }, i) => (
            <FadeIn key={key} delay={i * 100}>
              <div className={`rounded-2xl border p-6 space-y-5 ${highlight ? 'border-primary ring-2 ring-primary/20 bg-primary/5 scale-[1.02]' : 'bg-card'}`}>
                {highlight && <div className="text-xs font-bold text-primary uppercase tracking-widest text-center">Most Popular</div>}
                <div>
                  <h3 className="font-bold text-xl">{name}</h3>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-bold">{price}</span>
                    <span className="text-sm text-muted-foreground">/{period}</span>
                  </div>
                </div>
                <ul className="space-y-2.5">
                  {features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button className={`w-full ${highlight ? 'gradient-primary border-0 text-white' : ''}`} variant={highlight ? 'default' : 'outline'} asChild>
                  <Link to="/auth?mode=signup">{cta}</Link>
                </Button>
              </div>
            </FadeIn>
          ))}
        </div>
        <FadeIn delay={300}>
          <p className="text-center text-xs text-muted-foreground mt-8">All prices in ZMW · Cancel any time · 14-day money-back guarantee</p>
        </FadeIn>
      </div>
    </section>
  );
}

/* ── Final CTA ────────────────────────────────────────────────── */
function FinalCTA() {
  return (
    <section className="py-24 bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <FadeIn>
          <div className="rounded-3xl gradient-primary p-12 space-y-6 shadow-2xl">
            <Zap className="h-12 w-12 text-white/80 mx-auto" />
            <h2 className="text-4xl font-bold text-white font-display">Ready to put your marketing on autopilot?</h2>
            <p className="text-white/80 text-lg max-w-xl mx-auto">
              Join 500+ brands generating consistent, on-brand content across every platform — in minutes, not hours.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="bg-white text-primary hover:bg-white/90 font-semibold h-12 px-8" asChild>
                <Link to="/auth?mode=signup">Start free today →</Link>
              </Button>
              <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 h-12 px-8" asChild>
                <Link to="/auth">Sign in</Link>
              </Button>
            </div>
            <p className="text-white/60 text-xs">No credit card required · Free plan forever · Setup in 5 minutes</p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ── Footer ───────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="border-t bg-background py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-2 md:col-span-1 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center"><Rocket className="h-4 w-4 text-white"/></div>
              <span className="font-bold font-display">BrandPilot</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">AI marketing autopilot for growing brands in Africa and beyond.</p>
          </div>
          {[
            { label:'Product', links:[['#features','Features'],['#pricing','Pricing'],['#how','How it works']] },
            { label:'Company', links:[['#','About'],['#','Blog'],['#','Careers']] },
            { label:'Legal',   links:[['#','Privacy Policy'],['#','Terms of Service'],['#','GDPR']] },
          ].map(({ label, links }) => (
            <div key={label}>
              <p className="font-semibold text-sm mb-3">{label}</p>
              <ul className="space-y-2">
                {links.map(([href, name]) => <li key={name}><a href={href} className="text-xs text-muted-foreground hover:text-foreground transition-colors">{name}</a></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t pt-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} BrandPilot. All rights reserved.</p>
          <p>Made with ❤️ in Zambia</p>
        </div>
      </div>
    </footer>
  );
}

/* ── Keyframe style injection ─────────────────────────────────── */
const style = `
  @keyframes fadeSlideIn {
    from { opacity: 0; transform: translateY(-12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

/* ── Page assembly ────────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <>
      <style>{style}</style>
      <Nav />
      <Hero />
      <Features />
      <HowItWorks />
      <Testimonials />
      <Pricing />
      <FinalCTA />
      <Footer />
    </>
  );
}

          </div>
        </FadeIn>

        {/* Dashboard preview */}
        <FadeIn delay={500}>
          <div className="relative mx-auto max-w-4xl mt-4">
            <div className="rounded-2xl border bg-card shadow-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/50">
                <div className="flex gap-1.5"><div className="h-3 w-3 rounded-full bg-red-400"/><div className="h-3 w-3 rounded-full bg-amber-400"/><div className="h-3 w-3 rounded-full bg-green-400"/></div>
                <div className="flex-1 h-5 rounded bg-muted mx-8 text-xs flex items-center justify-center text-muted-foreground">app.brandpilot.co</div>
              </div>
              <div className="p-4 grid grid-cols-3 gap-3 min-h-[220px] bg-background">
                {[{icon:Brain,label:'Brand Brain',color:'bg-purple-500/10 text-purple-500'},{icon:Pen,label:'Content Engine',color:'bg-blue-500/10 text-blue-500'},{icon:CalendarClock,label:'Scheduler',color:'bg-green-500/10 text-green-500'},{icon:MessageSquareReply,label:'Replies',color:'bg-orange-500/10 text-orange-500'},{icon:BarChart3,label:'Analytics',color:'bg-pink-500/10 text-pink-500'},{icon:Users,label:'Team',color:'bg-indigo-500/10 text-indigo-500'}].map(({icon:Icon,label,color})=>(
                  <div key={label} className="rounded-xl border bg-card p-4 flex flex-col items-center gap-2 hover:border-primary/40 transition-colors cursor-pointer">
                    <div className={`h-10 w-10 rounded-lg ${color} flex items-center justify-center`}><Icon className="h-5 w-5"/></div>
                    <span className="text-xs font-medium text-center">{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">↓ Keep scrolling</div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
