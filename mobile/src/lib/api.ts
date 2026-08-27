import {
  getToken,
  getRefreshToken,
  saveToken,
  saveRefreshToken,
  getTenantId,
} from './auth-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

export type UserProfile = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  tenant?: {
    id: string;
    name: string;
    slug?: string;
    logoUrl?: string | null;
  } | null;
};

export type AuthTokensResponse = {
  token?: string;
  accessToken?: string;
  refreshToken?: string | null;
  user?: Record<string, unknown>;
  tenant?: {
    id: string;
    name: string;
    slug?: string;
    logoUrl?: string | null;
  };
};

type SessionHooks = {
  onAccessTokenUpdated?: (accessToken: string) => void;
  onAuthFailure?: () => void;
};

let sessionHooks: SessionHooks = {};

export function setSessionHooks(hooks: SessionHooks) {
  sessionHooks = hooks;
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return null;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        signal: controller.signal,
      });
      clearTimeout(id);

      if (!response.ok) return null;

      const data = (await response.json()) as AuthTokensResponse;
      const accessToken = data.accessToken || data.token;
      if (!accessToken) return null;

      await saveToken(accessToken);
      sessionHooks.onAccessTokenUpdated?.(accessToken);
      return accessToken;
    } catch {
      clearTimeout(id);
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

function messageFromErrorBody(errorData: unknown, fallback: string): string {
  if (!errorData || typeof errorData !== 'object') return fallback;
  const data = errorData as { message?: string | string[] };
  if (Array.isArray(data.message)) return data.message.join(', ');
  if (typeof data.message === 'string') return data.message;
  return fallback;
}

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}, retried = false) {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const token = await getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(id);

    if (response.status === 401 && !retried) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return fetchWithAuth(endpoint, options, true);
      }
      sessionHooks.onAuthFailure?.();
      throw new Error('Your session has expired. Please sign in again.');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(messageFromErrorBody(errorData, 'API request failed'));
    }

    if (response.status === 204) return null;
    return response.json();
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection.');
    }
    if (
      error.message &&
      (error.message.includes('Network request failed') ||
        error.message.includes('Failed to fetch'))
    ) {
      throw new Error('You appear to be offline. Please check your internet connection.');
    }
    throw error;
  }
}

export const api = {
  login: async (email: string, password: string): Promise<AuthTokensResponse> => {
    return fetchWithAuth('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  signup: async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ): Promise<AuthTokensResponse> => {
    return fetchWithAuth('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, firstName, lastName }),
    });
  },
  googleAuth: async (token: string): Promise<AuthTokensResponse> => {
    return fetchWithAuth('/api/v1/auth/google-auth', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },
  refresh: async (refreshToken: string): Promise<AuthTokensResponse> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        signal: controller.signal,
      });
      clearTimeout(id);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(messageFromErrorBody(errorData, 'Failed to refresh session'));
      }
      return response.json();
    } catch (error: any) {
      clearTimeout(id);
      if (error.name === 'AbortError') {
        throw new Error('Request timed out. Please check your connection.');
      }
      throw error;
    }
  },
  getProfile: async (): Promise<UserProfile> => {
    const data = await fetchWithAuth('/api/v1/auth/me');
    const user = data?.user ?? data ?? {};
    return {
      id: String(user.id ?? ''),
      email: user.email ?? null,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      avatarUrl: user.avatarUrl ?? null,
      tenant: data?.tenant ?? null,
    };
  },
  getWorkspaces: async (tenantId?: string | null) => {
    const resolvedTenant = tenantId ?? (await getTenantId());
    const qs = resolvedTenant ? `?tenantId=${encodeURIComponent(resolvedTenant)}` : '';
    return fetchWithAuth(`/api/v1/workspaces${qs}`);
  },
};
