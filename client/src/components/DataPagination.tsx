import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  /** Zero-based. */
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  pageSizes?: number[];
  onPageSizeChange?: (size: number) => void;
  noun?: string;
  className?: string;
};

/** 1 … 4 5 [6] 7 8 … 20, always showing the first and last page. */
function pageList(current: number, count: number): Array<number | 'gap'> {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i);
  const pages = new Set([0, count - 1, current - 1, current, current + 1]);
  if (current <= 2) [1, 2, 3].forEach((p) => pages.add(p));
  if (current >= count - 3) [count - 4, count - 3, count - 2].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 0 && p < count).sort((a, b) => a - b);
  const out: Array<number | 'gap'> = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push('gap');
    out.push(p);
  });
  return out;
}

export function DataPagination({
  page,
  pageSize,
  total,
  onPageChange,
  pageSizes = [25, 50, 100],
  onPageSizeChange,
  noun = 'items',
  className,
}: Props) {
  const count = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : page * pageSize + 1;
  const last = Math.min(total, (page + 1) * pageSize);
  const btn =
    'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-medium tabular-nums transition-colors disabled:pointer-events-none disabled:opacity-40';

  return (
    <nav
      aria-label="Pagination"
      className={cn('flex flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between', className)}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="tabular-nums">
          {total === 0 ? `No ${noun}` : (
            <>
              <span className="font-medium text-foreground">{first.toLocaleString()}–{last.toLocaleString()}</span> of{' '}
              {total.toLocaleString()} {noun}
            </>
          )}
        </p>
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5">
            Show
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 rounded-md border bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {pageSizes.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            per page
          </label>
        )}
      </div>

      {count > 1 && (
        <div className="flex items-center gap-1">
          <button type="button" className={cn(btn, 'gap-1 hover:bg-muted')} onClick={() => onPageChange(page - 1)} disabled={page === 0} aria-label="Previous page">
            <ChevronLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Previous</span>
          </button>
          <div className="hidden items-center gap-1 sm:flex">
            {pageList(page, count).map((p, i) =>
              p === 'gap' ? (
                <span key={`gap-${i}`} className="px-1" aria-hidden>…</span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p)}
                  aria-current={p === page ? 'page' : undefined}
                  className={cn(btn, p === page ? 'bg-foreground text-background' : 'text-foreground hover:bg-muted')}
                >
                  {p + 1}
                </button>
              ),
            )}
          </div>
          <span className="px-2 tabular-nums sm:hidden">
            {page + 1} / {count}
          </span>
          <button type="button" className={cn(btn, 'gap-1 hover:bg-muted')} onClick={() => onPageChange(page + 1)} disabled={page >= count - 1} aria-label="Next page">
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </nav>
  );
}
