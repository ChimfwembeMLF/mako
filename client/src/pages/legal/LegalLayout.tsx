import { Link, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { FileText, Shield, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import Logo from '@/components/Logo';
import { AppBreadcrumbs } from '@/components/AppBreadcrumbs';

const LEGAL_PAGES = [
  { to: '/privacy', label: 'Privacy', icon: Shield },
  { to: '/terms', label: 'Terms', icon: FileText },
  { to: '/data-deletion', label: 'Data deletion', icon: Trash2 },
] as const;

interface LegalLayoutProps {
  title: string;
  description: string;
  icon: LucideIcon;
  lastUpdated?: string;
  children: React.ReactNode;
}

export function LegalSection({
  icon: Icon,
  title,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="scroll-mt-28">
      <div className="flex items-start gap-3 mb-4">
        {Icon && (
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <h2 className="text-lg font-semibold font-display tracking-tight text-foreground pt-1.5">
          {title}
        </h2>
      </div>
      <div className="text-[15px] leading-relaxed text-muted-foreground space-y-3 pl-0 sm:pl-12">
        {children}
      </div>
    </section>
  );
}

export function LegalCallout({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'accent';
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3 text-sm leading-relaxed',
        variant === 'accent'
          ? 'border-primary/20 bg-primary/5 text-foreground'
          : 'border-border bg-muted/30 text-muted-foreground',
      )}
    >
      {children}
    </div>
  );
}

export function LegalLayout({
  title,
  description,
  icon: PageIcon,
  lastUpdated = 'June 2025',
  children,
}: LegalLayoutProps) {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 right-0 h-[28rem] w-[28rem] rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute bottom-0 -left-24 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2 group">
            <Logo className="!h-24 w-24" />
            {/* <span className="hidden sm:inline text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
              Mako 
            </span> */}
          </Link>
          <nav className="flex items-center gap-1 rounded-full border bg-card/80 p-1 text-xs sm:text-sm">
            {LEGAL_PAGES.map(({ to, label, icon: Icon }) => {
              const active = pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                  )}
                >
                  <Icon className="h-3.5 w-3.5 hidden sm:block" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <AppBreadcrumbs className="mb-6" />

        <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <PageIcon className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-primary mb-1">Legal</p>
              <h1 className="text-3xl sm:text-4xl font-bold font-display tracking-tight">{title}</h1>
              <p className="mt-2 max-w-2xl text-muted-foreground text-[15px] leading-relaxed">{description}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground shrink-0 rounded-full border bg-card px-3 py-1.5">
            Last updated {lastUpdated}
          </p>
        </div>

        <article className="rounded-2xl border bg-card/80 shadow-sm backdrop-blur-sm">
          <div className="space-y-10 p-6 sm:p-10">{children}</div>
        </article>

        <footer className="mt-12 flex flex-col items-center gap-4 border-t pt-8 text-center text-sm text-muted-foreground sm:flex-row sm:justify-between sm:text-left">
          <p>© {new Date().getFullYear()} Mako  · Tekrem Innovation Solutions</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/auth" className="hover:text-foreground transition-colors">Sign in</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link to="/data-deletion" className="hover:text-foreground transition-colors">Data deletion</Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
