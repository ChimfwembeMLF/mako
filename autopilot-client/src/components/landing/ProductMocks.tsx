import { useState } from 'react';
import { Brain, Pen, CalendarClock, BarChart3, MessageSquareReply, Link2 } from 'lucide-react';

export function BrowserChrome({
  children,
  url = 'app.autopilot.co',
  className = '',
}: {
  children: React.ReactNode;
  url?: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border bg-card shadow-2xl overflow-hidden ${className}`}
      style={{ transform: 'perspective(1200px) rotateX(2deg)' }}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/60">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400/90" />
          <div className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
        </div>
        <div className="flex-1 mx-4 h-6 rounded-md bg-background/80 text-[10px] text-muted-foreground flex items-center justify-center font-mono">
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
}: {
  src: string;
  alt: string;
  mock: React.ReactNode;
  url?: string;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <BrowserChrome url={url} className={className}>
      <div className="relative">
        {!failed && (
          <img
            src={src}
            alt={alt}
            className={`w-full block transition-opacity duration-500 ${loaded ? 'opacity-100 relative' : 'opacity-0 absolute inset-0 pointer-events-none'}`}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            loading="lazy"
          />
        )}
        {(!loaded || failed) && mock}
      </div>
    </BrowserChrome>
  );
}

export function MockBrandBrain() {
  return (
    <div className="p-5 space-y-4 min-h-[280px] bg-gradient-to-br from-purple-500/5 to-indigo-500/10">
      <div className="flex items-center gap-2">
        <Brain className="h-5 w-5 text-purple-600" />
        <span className="font-semibold text-sm">Brand Brain</span>
        <span className="ml-auto text-[10px] bg-emerald-500/15 text-emerald-700 px-2 py-0.5 rounded-full">Complete</span>
      </div>
      {[
        ['Company', 'Tekrem Innvation Solutions — Smart farming solutions'],
        ['Tone', 'Professional, warm, expert'],
        ['Audience', 'Farmers, agri-dealers, cooperatives'],
        ['USPs', 'Yield insights · Mobile payments · Local support'],
      ].map(([label, val]) => (
        <div key={label} className="rounded-lg border bg-card/80 p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-xs mt-1 font-medium">{val}</p>
        </div>
      ))}
    </div>
  );
}

export function MockContentEngine() {
  return (
    <div className="p-5 space-y-3 min-h-[280px]">
      <div className="flex items-center gap-2">
        <Pen className="h-5 w-5 text-blue-600" />
        <span className="font-semibold text-sm">Content Engine</span>
      </div>
      <div className="rounded-lg border p-3 bg-muted/30">
        <p className="text-[10px] text-muted-foreground mb-1">Generated for Instagram</p>
        <p className="text-xs leading-relaxed">
          🌾 Ready for harvest season? Tekrem Innvation Solutions helps you track yields and sell smarter...
          <span className="text-primary"> #AgriTech #Zambia</span>
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {['Facebook', 'LinkedIn', 'Email'].map((p) => (
          <div key={p} className="rounded-md border bg-card p-2 text-[10px] text-center text-muted-foreground">
            {p}
          </div>
        ))}
      </div>
      <div className="h-16 rounded-lg border bg-gradient-to-r from-primary/20 to-purple-500/20 animate-pulse" />
    </div>
  );
}

export function MockPublish() {
  return (
    <div className="p-5 space-y-3 min-h-[280px]">
      <p className="text-xs font-semibold">Publish — 3 platforms</p>
      <div className="flex gap-2">
        {['facebook', 'instagram', 'linkedin'].map((p) => (
          <div key={p} className="flex-1 rounded-lg border p-2 text-center capitalize text-[10px] bg-primary/5 border-primary/30">
            {p}
          </div>
        ))}
      </div>
      <div className="rounded-xl border p-3 space-y-2">
        <div className="flex gap-2">
          <div className="w-14 h-14 rounded-lg bg-muted shrink-0" />
          <p className="text-[11px] text-muted-foreground line-clamp-3">
            Platform-native copy with attachments — carousel preview per channel...
          </p>
        </div>
        <div className="h-8 rounded-md gradient-primary opacity-90 flex items-center justify-center text-[10px] text-white font-medium">
          Publish to 3 platforms
        </div>
      </div>
    </div>
  );
}

export function MockScheduler() {
  return (
    <div className="p-5 min-h-[280px]">
      <div className="flex items-center gap-2 mb-3">
        <CalendarClock className="h-5 w-5 text-emerald-600" />
        <span className="font-semibold text-sm">Scheduler</span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-[9px] text-center text-muted-foreground mb-2">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 14 }).map((_, i) => (
          <div
            key={i}
            className={`aspect-square rounded-md border text-[8px] flex items-end justify-center p-0.5 ${
              i === 3 || i === 8 ? 'bg-primary/15 border-primary/40' : 'bg-muted/20'
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
    <div className="p-5 min-h-[280px] space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-pink-600" />
        <span className="font-semibold text-sm">Analytics</span>
      </div>
      <div className="flex items-end gap-1 h-24 px-2">
        {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-gradient-to-t from-primary to-primary/40"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[['12.4k', 'Reach'], ['842', 'Engagement'], ['156', 'Leads']].map(([v, l]) => (
          <div key={l} className="rounded-lg border p-2">
            <p className="text-sm font-bold">{v}</p>
            <p className="text-[9px] text-muted-foreground">{l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MockReplies() {
  return (
    <div className="p-5 min-h-[280px] space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <MessageSquareReply className="h-5 w-5 text-orange-600" />
        <span className="font-semibold text-sm">Reply Queue</span>
      </div>
      {[
        { user: 'Thandi M.', text: 'Love this product! Where can I buy?', status: 'pending' },
        { user: 'John K.', text: 'Do you deliver to Kitwe?', status: 'sent' },
      ].map((c) => (
        <div key={c.user} className="rounded-lg border p-3 text-xs">
          <div className="flex justify-between">
            <span className="font-medium">{c.user}</span>
            <span className={c.status === 'sent' ? 'text-emerald-600' : 'text-amber-600'}>{c.status}</span>
          </div>
          <p className="text-muted-foreground mt-1">{c.text}</p>
        </div>
      ))}
    </div>
  );
}

export function MockPublisher() {
  return (
    <div className="p-5 min-h-[200px] space-y-3">
      <div className="flex items-center gap-2">
        <Link2 className="h-5 w-5 text-teal-600" />
        <span className="font-semibold text-sm">Publisher Connect</span>
      </div>
      {['Facebook Page', 'Instagram Business', 'LinkedIn Profile'].map((name) => (
        <div key={name} className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
          <span>{name}</span>
          <span className="text-emerald-600 font-medium">Connected</span>
        </div>
      ))}
    </div>
  );
}
