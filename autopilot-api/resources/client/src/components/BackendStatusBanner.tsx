import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBackendStatus } from '@/hooks/useBackendStatus';
import { API_BASE_URL } from '@/lib/api';

export function BackendStatusBanner() {
  const { available, checking, recheck } = useBackendStatus();

  if (available) return null;

  return (
    <div
      role="alert"
      className="sticky top-0 z-[60] border-b border-amber-500/30 bg-amber-50 text-amber-950 dark:bg-amber-950/90 dark:text-amber-50 px-4 py-2.5"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Can&apos;t reach the API at <code className="text-xs">{API_BASE_URL}</code>. Some features won&apos;t load until it&apos;s back.
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 border-amber-600/30 bg-white/60 dark:bg-black/20"
          onClick={() => recheck()}
          disabled={checking}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${checking ? 'animate-spin' : ''}`} />
          {checking ? 'Checking…' : 'Retry'}
        </Button>
      </div>
    </div>
  );
}
