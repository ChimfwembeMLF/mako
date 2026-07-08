import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { API_BASE_URL, authApi, getAuthToken } from '@/lib/api';
import { isNetworkError, onApiStatusChange } from '@/lib/api-errors';

interface BackendStatusContextValue {
  available: boolean;
  checking: boolean;
  lastError: string | null;
  recheck: () => Promise<void>;
}

const BackendStatusContext = createContext<BackendStatusContextValue>({
  available: true,
  checking: false,
  lastError: null,
  recheck: async () => {},
});

export function BackendStatusProvider({ children }: { children: ReactNode }) {
  const [available, setAvailable] = useState(true);
  const [checking, setChecking] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const recheck = useCallback(async () => {
    setChecking(true);
    try {
      const token = getAuthToken();
      if (token) {
        await authApi.getMe();
      } else {
        const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (!res) throw new Error('offline');
      }
      setAvailable(true);
      setLastError(null);
    } catch (err) {
      if (isNetworkError(err)) {
        setAvailable(false);
        setLastError('Unable to reach the server');
      } else {
        setAvailable(true);
        setLastError(null);
      }
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    return onApiStatusChange((isUp) => {
      setAvailable(isUp);
      if (isUp) setLastError(null);
    });
  }, []);

  return (
    <BackendStatusContext.Provider value={{ available, checking, lastError, recheck }}>
      {children}
    </BackendStatusContext.Provider>
  );
}

export function useBackendStatus() {
  return useContext(BackendStatusContext);
}
