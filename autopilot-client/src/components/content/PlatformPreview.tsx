import { platformOf, PlatformPayload, stripHtml } from '@/lib/platforms';
import { cn } from '@/lib/utils';

interface PlatformPreviewProps {
  platform: string;
  payload: PlatformPayload;
  mediaUrls?: string[];
  className?: string;
}

export function PlatformPreview({ platform, payload, mediaUrls = [], className }: PlatformPreviewProps) {
  const def = platformOf(platform);
  const Icon = def.icon;
  const text = stripHtml(payload.content);
  const charCount = text.length;
  const overLimit = charCount > def.maxChars;

  if (def.previewType === 'email') {
    return (
      <div className={cn('rounded-xl border bg-card overflow-hidden', className)}>
        <div className="px-4 py-3 border-b bg-muted/40 flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color: def.color }} />
          <span className="text-xs font-medium">Email preview</span>
        </div>
        <div className="p-4 space-y-2 text-sm">
          <p className="font-semibold">{payload.title || 'Subject line'}</p>
          <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{text}</p>
        </div>
      </div>
    );
  }

  if (def.previewType === 'ad') {
    return (
      <div className={cn('rounded-xl border bg-card overflow-hidden', className)}>
        <div className="px-4 py-2 border-b bg-amber-500/10 flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color: def.color }} />
          <span className="text-xs font-medium">Ad preview</span>
        </div>
        <div className="p-4">
          {mediaUrls[0] && (
            <img src={mediaUrls[0]} alt="" className="w-full h-32 object-cover rounded-lg mb-3" />
          )}
          <p className="font-semibold text-sm">{payload.title}</p>
          <p className="text-sm text-muted-foreground mt-1">{text}</p>
          <span className="inline-block mt-3 text-xs px-3 py-1 rounded-full bg-primary text-primary-foreground">Learn more</span>
        </div>
      </div>
    );
  }

  // Social feed mock
  return (
    <div className={cn('rounded-xl border bg-card overflow-hidden max-w-md', className)}>
      <div className="px-4 py-3 flex items-center gap-2 border-b">
        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
          <Icon className="h-4 w-4" style={{ color: def.color }} />
        </div>
        <div>
          <p className="text-sm font-semibold leading-none">Your Brand</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{def.label} · Just now</p>
        </div>
      </div>
      {mediaUrls[0] && (
        <img src={mediaUrls[0]} alt="" className="w-full max-h-48 object-cover border-y" />
      )}
      <div className="p-4">
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{text || 'Your post content will appear here…'}</p>
      </div>
      <div className={cn('px-4 pb-3 text-[10px]', overLimit ? 'text-destructive' : 'text-muted-foreground')}>
        {charCount.toLocaleString()} / {def.maxChars.toLocaleString()} characters
      </div>
    </div>
  );
}
