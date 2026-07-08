import { ThumbsUp } from 'lucide-react';

type Reaction = { type: string; count?: number };

const REACTION_LABELS: Record<string, string> = {
  like: '👍',
  love: '❤️',
  haha: '😂',
  wow: '😮',
  sad: '😢',
  angry: '😠',
};

export function MessageReactions({ items }: { items: Reaction[] }) {
  if (!items?.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {items.map((r, i) => (
        <span
          key={`${r.type}-${i}`}
          className="inline-flex items-center gap-0.5 text-[10px] bg-muted/80 px-1.5 py-0.5 rounded-full"
        >
          {REACTION_LABELS[r.type] ?? <ThumbsUp className="h-2.5 w-2.5" />}
          {(r.count ?? 0) > 0 && <span>{r.count}</span>}
        </span>
      ))}
    </div>
  );
}
