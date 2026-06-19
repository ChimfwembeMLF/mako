import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';

/**
 * Shown after a new production deploy when the service worker has a fresher app bundle.
 * User taps Update to activate the new version and reload.
 */
export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisterError(error) {
      console.warn('[PWA] Service worker registration failed:', error);
    },
  });

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

    const checkForUpdates = () => {
      void navigator.serviceWorker.getRegistration().then((reg) => reg?.update());
    };

    const onFocus = () => {
      if (document.visibilityState === 'visible') checkForUpdates();
    };

    const interval = window.setInterval(checkForUpdates, 60 * 60 * 1000);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);

  if (!import.meta.env.PROD || !needRefresh) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-[150] mx-auto flex max-w-lg items-center justify-between gap-3 rounded-xl border border-primary/30 bg-card px-4 py-3 shadow-lg sm:left-auto sm:right-6"
      role="status"
      aria-live="polite"
    >
      <div className="min-w-0 text-left">
        <p className="text-sm font-medium">Update available</p>
        <p className="text-xs text-muted-foreground">A new version of Mako was deployed.</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={() => setNeedRefresh(false)}
        >
          Later
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => void updateServiceWorker(true)}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Update
        </Button>
      </div>
    </div>
  );
}
