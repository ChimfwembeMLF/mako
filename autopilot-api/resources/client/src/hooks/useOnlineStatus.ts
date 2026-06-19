import { useCallback, useEffect, useState } from 'react';
import { resolveApiBaseUrl } from '@/lib/api';

type OnlineStatus = 'checking' | 'online' | 'offline';

async function pingBackend(): Promise<boolean> {
  if (!navigator.onLine) return false;
  try {
    const base = resolveApiBaseUrl();
    const url = `${base}/api/v1/health`;
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function useOnlineStatus() {
  const [status, setStatus] = useState<OnlineStatus>(() =>
    typeof navigator !== 'undefined' && navigator.onLine ? 'checking' : 'offline',
  );

  const verify = useCallback(async () => {
    if (!navigator.onLine) {
      setStatus('offline');
      return false;
    }
    setStatus('checking');
    const ok = await pingBackend();
    setStatus(ok ? 'online' : 'offline');
    return ok;
  }, []);

  useEffect(() => {
    void verify();

    const onOnline = () => void verify();
    const onOffline = () => setStatus('offline');

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void verify();
    }, 60_000);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.clearInterval(interval);
    };
  }, [verify]);

  return {
    status,
    isOnline: status === 'online',
    isOffline: status === 'offline',
    isChecking: status === 'checking',
    retry: verify,
  };
}
