import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  clearSession,
  getRefreshToken,
  getToken,
  saveRefreshToken,
  saveTenantId,
  saveToken,
} from '../lib/auth-store';
import { api, setSessionHooks, type AuthTokensResponse } from '../lib/api';
import { queryClient } from '../lib/query-client';

export interface UserSession {
  accessToken: string;
  refreshToken: string | null;
  userId: string;
  expiresAt: number;
}

export type SignInPayload = {
  token: string;
  refreshToken?: string | null;
  tenantId?: string | null;
};

interface AuthContextType {
  token: string | null;
  session: UserSession | null;
  isLoading: boolean;
  signIn: (payload: SignInPayload | string) => Promise<void>;
  signOut: () => Promise<void>;
}

const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
const atob = (input: string = '') => {
  let str = input.replace(/=+$/, '');
  let output = '';
  for (
    let bc = 0, bs = 0, buffer, i = 0;
    (buffer = str.charAt(i++));
    ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
      ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
      : 0
  ) {
    buffer = chars.indexOf(buffer);
  }
  return output;
};

function parseJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join(''),
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function buildSession(accessToken: string, refreshToken: string | null): UserSession {
  const decoded = parseJwt(accessToken);
  return {
    accessToken,
    refreshToken,
    userId: decoded?.sub || decoded?.id || 'unknown',
    expiresAt: decoded?.exp ? decoded.exp * 1000 : 0,
  };
}

function isExpired(expiresAt: number) {
  if (!expiresAt) return false;
  return Date.now() >= expiresAt - 30_000;
}

export function normalizeAuthResponse(response: AuthTokensResponse): SignInPayload | null {
  const token = response.token || response.accessToken;
  if (!token) return null;
  return {
    token,
    refreshToken: response.refreshToken ?? null,
    tenantId: response.tenant?.id ?? null,
  };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applySession = useCallback(async (accessToken: string, refreshToken: string | null) => {
    try {
      await saveToken(accessToken);
      await saveRefreshToken(refreshToken);
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? `Could not save session securely: ${error.message}`
          : 'Could not save session securely on this device.',
      );
    }
    setToken(accessToken);
    setSession(buildSession(accessToken, refreshToken));
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // local clear still required
    }
    await clearSession();
    queryClient.clear();
    setToken(null);
    setSession(null);
  }, []);

  const signIn = useCallback(
    async (payload: SignInPayload | string) => {
      const normalized =
        typeof payload === 'string'
          ? { token: payload, refreshToken: null as string | null, tenantId: null as string | null }
          : payload;

      if (normalized.tenantId !== undefined) {
        await saveTenantId(normalized.tenantId);
      }

      await applySession(normalized.token, normalized.refreshToken ?? null);
    },
    [applySession],
  );

  useEffect(() => {
    setSessionHooks({
      onAccessTokenUpdated: (accessToken) => {
        setToken(accessToken);
        setSession((prev) => buildSession(accessToken, prev?.refreshToken ?? null));
      },
      onAuthFailure: () => {
        void signOut();
      },
    });
  }, [signOut]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const storedToken = await getToken();
        const storedRefresh = await getRefreshToken();

        if (!storedToken) {
          if (!cancelled) setIsLoading(false);
          return;
        }

        const candidate = buildSession(storedToken, storedRefresh);

        if (!isExpired(candidate.expiresAt)) {
          if (!cancelled) {
            setToken(storedToken);
            setSession(candidate);
          }
          return;
        }

        if (storedRefresh) {
          try {
            const refreshed = await api.refresh(storedRefresh);
            const accessToken = refreshed.accessToken || refreshed.token;
            if (accessToken && !cancelled) {
              await applySession(accessToken, storedRefresh);
              return;
            }
          } catch {
            // fall through
          }
        }

        if (!cancelled) {
          await clearSession();
          setToken(null);
          setSession(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applySession]);

  return (
    <AuthContext.Provider value={{ token, session, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
