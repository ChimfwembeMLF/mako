import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Brain, Send, Inbox } from 'lucide-react';
import Logo from '@/components/Logo';
import { DeviceMockup } from '@/components/landing/DeviceMockup';
import { cn } from '@/lib/utils';

type Slide = {
  id: string;
  icon: typeof Brain;
  title: string;
  text: string;
  /** The big device, then an optional phone overlapping its corner. */
  main: { device: 'desktop' | 'tablet'; src: string; alt: string };
  phone?: { src: string; alt: string };
};

const SLIDES: Slide[] = [
  {
    id: 'voice',
    icon: Brain,
    title: 'It learns how your brand sounds',
    text: 'Set your voice, audience and offers once. Every post Mako writes follows them.',
    main: { device: 'tablet', src: '/screenshots/mako-brand-brain-tablet.webp', alt: 'Brand voice settings in Mako' },
  },
  {
    id: 'publish',
    icon: Send,
    title: 'Write once, post everywhere',
    text: 'Facebook, Instagram, LinkedIn, X and more, each in the right format, from one place.',
    main: { device: 'desktop', src: '/screenshots/mako-publishing-desktop.webp', alt: 'A post published to three channels in Mako' },
  },
  {
    id: 'inbox',
    icon: Inbox,
    title: 'Every reply in one inbox',
    text: 'Comments and messages from all your channels land together, with AI drafts ready to send.',
    main: { device: 'desktop', src: '/screenshots/mako-dashboard-desktop.webp', alt: 'The Mako social dashboard' },
    phone: { src: '/screenshots/mako-inbox-phone.webp', alt: 'The Mako inbox on a phone' },
  },
];

const SLIDE_MS = 6500;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    setReduced(mq.matches);
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

/** Product screenshots in device frames, one message at a time. */
function Showcase({ compact = false }: { compact?: boolean }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (paused || reduced) return;
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') setIndex((i) => (i + 1) % SLIDES.length);
    }, SLIDE_MS);
    return () => window.clearInterval(t);
  }, [paused, reduced]);

  const slide = SLIDES[index];
  const Icon = slide.icon;

  return (
    <div
      className="flex h-full flex-col"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="What you can do with Mako"
    >
      {/* Devices: all slides stay mounted and cross-fade, so images never reload. */}
      <div className={cn('relative grid flex-1 place-items-center', compact ? 'min-h-[220px]' : 'min-h-[320px]')}>
        {SLIDES.map((s, i) => (
          <div
            key={s.id}
            aria-hidden={i !== index}
            className={cn(
              'relative w-full [grid-area:1/1] transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none',
              i === index ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 translate-y-3',
            )}
          >
            <div className={cn('mx-auto', s.main.device === 'tablet' ? 'max-w-[440px]' : 'max-w-[520px]', s.phone && 'pr-[12%]')}>
              <DeviceMockup device={s.main.device}>
                <img src={s.main.src} alt={s.main.alt} className="h-full w-full object-cover object-top" loading={i === 0 ? 'eager' : 'lazy'} />
              </DeviceMockup>
            </div>
            {s.phone && (
              <div className="absolute bottom-[-6%] right-[2%] w-[22%] min-w-[90px] drop-shadow-2xl">
                <DeviceMockup device="phone">
                  <img src={s.phone.src} alt={s.phone.alt} className="h-full w-full object-cover object-top" loading="lazy" />
                </DeviceMockup>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Message */}
      <div className={cn('mx-auto w-full max-w-md text-center', compact ? 'mt-6' : 'mt-10')} aria-live={paused ? 'polite' : 'off'}>
        <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className={cn('mt-3 font-display font-semibold text-foreground', compact ? 'text-lg' : 'text-xl')}>{slide.title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{slide.text}</p>
        <div className="mt-5 flex justify-center gap-2" role="tablist" aria-label="Choose a slide">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={s.title}
              onClick={() => setIndex(i)}
              className={cn(
                'h-1.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                i === index ? 'w-6 bg-primary' : 'w-1.5 bg-foreground/20 hover:bg-foreground/40',
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * The frame for every signed-out page: the form on the left, a look at the product on
 * the right (below the form on phones).
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  showcase = true,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  showcase?: boolean;
}) {
  return (
    <div className="min-h-screen min-h-[100dvh] bg-background lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Phones: no forced full-screen height, so the product preview follows the form. */}
      <main className="flex flex-col px-5 py-6 sm:px-10 lg:min-h-[100dvh] lg:px-14 lg:py-8">
        <Link to="/" className="w-fit" aria-label="Mako home">
          <Logo className="h-10" />
        </Link>

        <div className="mx-auto flex w-full max-w-[400px] flex-col py-8 sm:py-12 lg:flex-1 lg:justify-center lg:py-10">
          <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>

        <footer className="mx-auto flex w-full max-w-[400px] flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {footer ?? <span>© {new Date().getFullYear()} Mako</span>}
          <span className="flex gap-3">
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
          </span>
        </footer>
      </main>

      {showcase && (
        <>
          {/* Desktop: the product beside the form. */}
          <aside className="relative hidden overflow-hidden p-4 lg:block">
            <div className="relative flex h-full flex-col justify-center overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary/15 via-primary/5 to-muted px-10 py-12">
              <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" aria-hidden />
              <div className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-primary/10 blur-3xl" aria-hidden />
              <div className="relative">
                <Showcase />
              </div>
            </div>
          </aside>
          {/* Phones and tablets: below the form. */}
          <section className="border-t border-border/60 bg-gradient-to-b from-primary/10 to-transparent px-5 py-10 lg:hidden" aria-label="About Mako">
            <Showcase compact />
          </section>
        </>
      )}
    </div>
  );
}

/** A password field with a show/hide button. */
export function PasswordField({
  id,
  value,
  onChange,
  autoComplete,
  placeholder = '••••••••',
  minLength = 6,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: 'current-password' | 'new-password';
  placeholder?: string;
  minLength?: number;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={shown ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        minLength={minLength}
        required
        className="flex h-12 w-full rounded-md border border-foreground bg-card px-4 pr-16 text-body-md placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
      />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-label={shown ? 'Hide password' : 'Show password'}
        aria-pressed={shown}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {shown ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
