import { Eye, Heart, MessageCircle, Share2 } from 'lucide-react';
import type { PlatformPreviewEngagement } from './types';
import { cn } from '@/lib/utils';

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function EngagementStats({
  engagement,
  className,
  variant = 'bar',
}: {
  engagement?: PlatformPreviewEngagement;
  className?: string;
  variant?: 'bar' | 'inline';
}) {
  if (!engagement) return null;

  const items = [
    { icon: Heart, value: engagement.likes, label: 'likes' },
    { icon: MessageCircle, value: engagement.comments, label: 'comments' },
    { icon: Share2, value: engagement.shares, label: 'shares' },
    { icon: Eye, value: engagement.views, label: 'views' },
  ].filter((item) => (item.value ?? 0) > 0);

  if (items.length === 0) return null;

  if (variant === 'inline') {
    return (
      <p className={cn('text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1', className)}>
        {items.map(({ icon: Icon, value, label }) => (
          <span key={label} className="inline-flex items-center gap-1">
            <Icon className="h-3 w-3" />
            {fmt(value!)} {label}
          </span>
        ))}
      </p>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 border-t text-xs text-muted-foreground',
        className,
      )}
    >
      {items.map(({ icon: Icon, value, label }) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">{fmt(value!)}</span>
          <span>{label}</span>
        </span>
      ))}
    </div>
  );
}
