import { Loader2, WifiOff } from 'lucide-react';
import Logo from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export function OfflineGate({ children }: { children: React.ReactNode }) {
  const { isOnline, isChecking, isOffline, retry } = useOnlineStatus();

  if (!import.meta.env.PROD) return <>{children}</>;
  if (isOnline) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background px-6 text-center">
      <Logo className="h-12 mb-8" />
      {isChecking ? (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-sm text-muted-foreground">Checking connection…</p>
        </>
      ) : (
        <>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted mb-4">
            <WifiOff className="h-7 w-7 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-semibold font-display mb-2">You&apos;re offline</h1>
          <p className="text-sm text-muted-foreground max-w-sm leading-relaxed mb-6">
            Mako needs an internet connection to load your workspace, sync content, and publish.
            {isOffline ? ' Connect to Wi‑Fi or mobile data, then try again.' : ''}
          </p>
          <Button onClick={() => void retry()}>Try again</Button>
        </>
      )}
    </div>
  );
}
