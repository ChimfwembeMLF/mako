import { useState } from 'react';
import { Brain, Pen, CalendarClock, BarChart3, MessageSquareReply, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ScreenshotDevice = 'desktop' | 'tablet' | 'phone';
export type ScreenshotVariant = 'float' | 'chrome';

const DEVICE_SIZE_CLASS: Record<ScreenshotDevice, string> = {
  desktop: 'w-full',
  tablet: 'w-full max-w-sm sm:max-w-md lg:max-w-lg mx-auto',
  phone: 'w-full max-w-[200px] sm:max-w-[260px] md:max-w-[300px] mx-auto',
};

export function BrowserChrome({
  children,
  url = 'mako.tekreminnovations.com',
  className = '',
}: {
  children: React.ReactNode;
  url?: string;
  className?: string;
}) {
  return (
    <div
      className={cn('rounded-2xl border border-border/80 bg-card shadow-card overflow-hidden', className)}
    >
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/60 bg-muted/40">
        <div className="flex gap-1.5">
          <div className="h-2 w-2 rounded-full bg-border" />
          <div className="h-2 w-2 rounded-full bg-border" />
          <div className="h-2 w-2 rounded-full bg-border" />
        </div>
        <div className="flex-1 mx-3 h-6 rounded-md bg-background border border-border/60 text-[10px] text-muted-foreground flex items-center justify-center font-mono truncate px-2">
          {url}
        </div>
      </div>
      <div className="relative bg-background">{children}</div>
    </div>
  );
}

export function ScreenshotFrame({
  src,
  alt,
  mock,
  url,
  className = '',
  variant = 'float',
  device = 'desktop',
  float = false,
}: {
  src: string;
  alt: string;
  mock: React.ReactNode;
  url?: string;
  className?: string;
  /** float = bare image on page bg; chrome = browser frame */
  variant?: ScreenshotVariant;
  device?: ScreenshotDevice;
  /** Gentle hover float animation (hero) */
  float?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const image = (
    <div className="relative">
      {!failed && (
        <img
          src={src}
          alt={alt}
          className={cn(
            'w-full h-auto block rounded-2xl transition-all duration-700 ease-out',
            variant === 'float' && 'landing-screenshot-shadow bg-transparent',
            loaded ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.97]',
          )}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          loading="lazy"
        />
      )}
      {(!loaded || failed) && mock}
    </div>
  );

  if (variant === 'chrome') {
    return (
      <div className={cn(DEVICE_SIZE_CLASS[device], className)}>
        <BrowserChrome url={url}>{image}</BrowserChrome>
      </div>
    );
  }

  return (
    <div className={cn(DEVICE_SIZE_CLASS[device], className)}>
      <div className={cn('relative group', float && 'landing-float motion-reduce:animate-none')}>
        <div
          className="pointer-events-none absolute inset-[8%] -z-10 landing-glow opacity-80 transition-opacity duration-500 group-hover:opacity-100"
          aria-hidden
        />
        <div className="transition-transform duration-500 ease-out group-hover:scale-[1.02] motion-reduce:group-hover:scale-100">
          {image}
        </div>
      </div>
    </div>
  );
}

export function MockBrandBrain() {
  return (
    <div className="p-5 space-y-3 min-h-[260px] rounded-2xl border border-dashed border-border/60">
      <div className="flex items-center gap-2 border-b border-border/60 pb-3">
        <Brain className="h-4 w-4 text-primary" />
        <span className="font-semibold text-sm">Brand profile</span>
        <span className="ml-auto text-[10px] font-medium text-accent px-2 py-0.5 rounded-full bg-accent/10">Complete</span>
      </div>
      {[
        ['Company', 'Tekrem Innovation Solutions'],
        ['Tone', 'Professional, clear, approachable'],
        ['Audience', 'SMEs and growing brands in Zambia'],
        ['Key messages', 'Local support · Multi-channel · One workspace'],
      ].map(([label, val]) => (
        <div key={label} className="rounded-lg border border-border/80 bg-card/50 p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-xs mt-1 font-medium text-foreground">{val}</p>
        </div>
      ))}
    </div>
  );
}

export function MockContentEngine() {
  return (
    <div className="p-5 space-y-3 min-h-[260px] rounded-2xl border border-dashed border-border/60">
      <div className="flex items-center gap-2 border-b border-border/60 pb-3">
        <Pen className="h-4 w-4 text-primary" />
        <span className="font-semibold text-sm">Content draft</span>
      </div>
      <div className="rounded-lg border border-border/80 p-3 bg-card/50">
        <p className="text-[10px] text-muted-foreground mb-1.5">Instagram · 220 characters</p>
        <p className="text-xs leading-relaxed text-foreground">
          New season, new goals. Here is how teams like yours stay consistent on social without hiring a full agency.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {['Facebook', 'LinkedIn', 'Email'].map((p) => (
          <div key={p} className="rounded-md border border-border/80 bg-muted/20 p-2 text-[10px] text-center text-muted-foreground">
            {p}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MockPublish() {
  return (
    <div className="p-5 space-y-3 min-h-[260px] rounded-2xl border border-dashed border-border/60">
      <p className="text-xs font-semibold text-foreground border-b border-border/60 pb-3">Publish to 3 channels</p>
      <div className="flex gap-2">
        {['Facebook', 'Instagram', 'LinkedIn'].map((p) => (
          <div key={p} className="flex-1 rounded-lg border border-primary/25 bg-primary/5 p-2 text-center text-[10px] font-medium text-foreground">
            {p}
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border/80 p-3 space-y-2 bg-card/50">
        <div className="flex gap-2">
          <div className="w-12 h-12 rounded-lg bg-muted/40 shrink-0" />
          <p className="text-[11px] text-muted-foreground line-clamp-3 leading-relaxed">
            Preview per platform before anything goes live. Attach images and adjust copy per channel.
          </p>
        </div>
        <div className="h-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-medium">
          Publish now
        </div>
      </div>
    </div>
  );
}

export function MockScheduler() {
  return (
    <div className="p-5 min-h-[260px] rounded-2xl border border-dashed border-border/60">
      <div className="flex items-center gap-2 mb-3 border-b border-border/60 pb-3">
        <CalendarClock className="h-4 w-4 text-primary" />
        <span className="font-semibold text-sm">Content calendar</span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-[9px] text-center text-muted-foreground mb-2">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={`${d}-${i}`}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 14 }).map((_, i) => (
          <div
            key={i}
            className={`aspect-square rounded-md border text-[8px] flex items-end justify-center p-0.5 ${
              i === 3 || i === 8 ? 'bg-primary/10 border-primary/30 text-foreground' : 'bg-muted/10 border-border/60'
            }`}
          >
            {i === 3 && 'IG'}
            {i === 8 && 'FB'}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MockAnalytics() {
  return (
    <div className="p-5 min-h-[260px] space-y-3 rounded-2xl border border-dashed border-border/60">
      <div className="flex items-center gap-2 border-b border-border/60 pb-3">
        <BarChart3 className="h-4 w-4 text-primary" />
        <span className="font-semibold text-sm">Last 30 days</span>
      </div>
      <div className="flex items-end gap-1 h-20 px-1">
        {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-primary/80 transition-all duration-500"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[['8.2k', 'Reach'], ['612', 'Engagement'], ['94', 'Leads']].map(([v, l]) => (
          <div key={l} className="rounded-lg border border-border/80 bg-card/50 p-2">
            <p className="text-sm font-bold text-foreground">{v}</p>
            <p className="text-[9px] text-muted-foreground">{l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MockReplies() {
  return (
    <div className="p-5 min-h-[260px] space-y-2 rounded-2xl border border-dashed border-border/60">
      <div className="flex items-center gap-2 mb-2 border-b border-border/60 pb-3">
        <MessageSquareReply className="h-4 w-4 text-primary" />
        <span className="font-semibold text-sm">Comment inbox</span>
      </div>
      {[
        { user: 'Thandi M.', text: 'Do you offer delivery to Kitwe?', status: 'Pending' },
        { user: 'John K.', text: 'Thanks — got the info I needed.', status: 'Replied' },
      ].map((c) => (
        <div key={c.user} className="rounded-lg border border-border/80 bg-card/50 p-3 text-xs">
          <div className="flex justify-between gap-2">
            <span className="font-medium text-foreground">{c.user}</span>
            <span className={c.status === 'Replied' ? 'text-accent' : 'text-muted-foreground'}>{c.status}</span>
          </div>
          <p className="text-muted-foreground mt-1 leading-relaxed">{c.text}</p>
        </div>
      ))}
    </div>
  );
}

export function MockPublisher() {
  return (
    <div className="p-5 min-h-[200px] space-y-3 rounded-2xl border border-dashed border-border/60">
      <div className="flex items-center gap-2 border-b border-border/60 pb-3">
        <Link2 className="h-4 w-4 text-primary" />
        <span className="font-semibold text-sm">Connected accounts</span>
      </div>
      {['Facebook Page', 'Instagram Business', 'LinkedIn'].map((name) => (
        <div key={name} className="flex items-center justify-between rounded-lg border border-border/80 bg-card/50 px-3 py-2 text-xs">
          <span className="text-foreground">{name}</span>
          <span className="text-accent font-medium">Connected</span>
        </div>
      ))}
    </div>
  );
}
