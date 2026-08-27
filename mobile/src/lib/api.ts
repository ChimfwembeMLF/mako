import {
  getToken,
  getRefreshToken,
  saveToken,
  saveRefreshToken,
  getTenantId,
} from './auth-store';

export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

export type UserProfile = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  role?: string | null;
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

export type ContentItem = {
  id: string;
  tenantId?: string;
  workspaceId?: string;
  title?: string | null;
  content?: string | null;
  status?: string | null;
  platforms?: string[] | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  publishedAt?: string | null;
  media?: Array<{ id?: string; url?: string; type?: string }>;
};

export type SocialAccount = {
  id: string;
  platform: string;
  accountName?: string | null;
  name?: string | null;
  connected?: boolean;
  workspaceId?: string | null;
};

export type InboxConversation = {
  id: string;
  channel?: string;
  platform?: string;
  preview?: string;
  title?: string;
  lastMessageAt?: string;
};

export type InboxMessage = {
  id: string;
  body?: string;
  message?: string;
  direction?: string;
  createdAt?: string;
  created_at?: string;
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

function messageFromErrorBody(errorData: unknown, fallback: string): string {
  if (!errorData || typeof errorData !== 'object') return fallback;
  const data = errorData as { message?: string | string[] };
  if (Array.isArray(data.message)) return data.message.join(', ');
  if (typeof data.message === 'string') return data.message;
  return fallback;
}

function mapNetworkError(error: any): never {
  if (error?.name === 'AbortError') {
    throw new Error('Request timed out. Please check your connection.');
  }
  if (
    error?.message &&
    (error.message.includes('Network request failed') ||
      error.message.includes('Failed to fetch'))
  ) {
    throw new Error('You appear to be offline. Please check your internet connection.');
  }
  throw error;
}

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

/** Public endpoints — never treat 401 as session expiry. */
export async function fetchPublic(endpoint: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
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

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(messageFromErrorBody(errorData, 'Request failed'));
    }

    if (response.status === 204) return null;
    return response.json();
  } catch (error: any) {
    clearTimeout(id);
    mapNetworkError(error);
  }
}

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}, retried = false) {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
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
    mapNetworkError(error);
  }
}

function withScope(params: Record<string, string | undefined | null>) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) qs.set(key, value);
  }
  const q = qs.toString();
  return q ? `?${q}` : '';
}

export const api = {
  login: (email: string, password: string): Promise<AuthTokensResponse> =>
    fetchPublic('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  signup: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ): Promise<AuthTokensResponse> =>
    fetchPublic('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, firstName, lastName }),
    }),

  googleAuth: (token: string): Promise<AuthTokensResponse> =>
    fetchPublic('/api/v1/auth/google-auth', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  refresh: async (refreshToken: string): Promise<AuthTokensResponse> =>
    fetchPublic('/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  logout: async () => {
    try {
      await fetchWithAuth('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // still clear local session
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
      role: user.role ?? null,
      tenant: data?.tenant ?? null,
    };
  },

  getWorkspaces: async (tenantId?: string | null) => {
    const resolvedTenant = tenantId ?? (await getTenantId());
    return fetchWithAuth(`/api/v1/workspaces${withScope({ tenantId: resolvedTenant })}`);
  },

  listContent: async (tenantId: string, workspaceId: string) => {
    const data = await fetchWithAuth(
      `/api/v1/content-items${withScope({ tenantId, workspaceId, includeMedia: 'true' })}`,
    );
    if (Array.isArray(data)) return data as ContentItem[];
    if (Array.isArray(data?.items)) return data.items as ContentItem[];
    if (Array.isArray(data?.data)) return data.data as ContentItem[];
    return [] as ContentItem[];
  },

  getContent: (id: string): Promise<ContentItem> => fetchWithAuth(`/api/v1/content-items/${id}`),

  createContent: (body: Record<string, unknown>): Promise<ContentItem> =>
    fetchWithAuth('/api/v1/content-items', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateContent: (id: string, body: Record<string, unknown>): Promise<ContentItem> =>
    fetchWithAuth(`/api/v1/content-items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  attachMedia: (
    id: string,
    tenantId: string,
    items: Array<{ url: string; type?: string; assetId?: string }>,
  ) =>
    fetchWithAuth(`/api/v1/content-items/${id}/media`, {
      method: 'POST',
      body: JSON.stringify({ tenantId, items }),
    }),

  publishContent: (contentId: string, platforms?: string[]) =>
    fetchWithAuth(`/api/v1/content-ai/${contentId}/publish`, {
      method: 'POST',
      body: JSON.stringify({ platforms }),
    }),

  uploadMedia: async (
    uri: string,
    tenantId: string,
    workspaceId?: string,
    contentId?: string,
    mimeType = 'image/jpeg',
    fileName = 'upload.jpg',
  ) => {
    const token = await getToken();
    const qs = withScope({ tenantId, workspaceId, contentId });
    const form = new FormData();
    form.append('file', {
      uri,
      name: fileName,
      type: mimeType,
    } as any);

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(`${API_URL}/api/v1/media/upload${qs}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
        signal: controller.signal,
      });
      clearTimeout(id);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(messageFromErrorBody(errorData, 'Upload failed'));
      }
      return response.json();
    } catch (error: any) {
      clearTimeout(id);
      mapNetworkError(error);
    }
  },

  listSocialAccounts: async (
    tenantId: string,
    workspaceId?: string,
  ): Promise<SocialAccount[]> => {
    const data = await fetchWithAuth(
      `/api/v1/social-accounts/tenant/${tenantId}${withScope({ workspaceId })}`,
    );
    if (Array.isArray(data)) return data as SocialAccount[];
    if (Array.isArray(data?.accounts)) return data.accounts as SocialAccount[];
    if (Array.isArray(data?.data)) return data.data as SocialAccount[];
    return [];
  },

  getEffectivePermissions: (
    tenantId: string,
    userId: string,
  ): Promise<{
    permissions: string[];
    isSystemAdmin?: boolean;
    isSuperAdmin?: boolean;
    roleId?: string | null;
    roleName?: string | null;
  }> =>
    fetchWithAuth(`/api/v1/rbac/effective-permissions/${tenantId}/${userId}`),

  startOAuth: (
    platform: string,
    tenantId: string,
    returnUrl: string,
    workspaceId?: string,
  ): Promise<{ redirectUrl: string }> =>
    fetchWithAuth(
      `/api/v1/social-accounts/oauth/${platform}/authorize${withScope({
        tenantId,
        returnUrl,
        workspaceId,
      })}`,
    ),

  getFacebookSetup: (token: string) =>
    fetchWithAuth(
      `/api/v1/social-accounts/facebook/setup?token=${encodeURIComponent(token)}`,
    ),

  finalizeFacebook: (data: { setupToken: string; pageId: string }) =>
    fetchWithAuth('/api/v1/social-accounts/facebook/finalize', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  disconnectSocial: (id: string, tenantId?: string) =>
    fetchWithAuth(
      `/api/v1/social-accounts/${id}/disconnect${withScope({ tenantId })}`,
      { method: 'POST' },
    ),

  listInboxConversations: (
    tenantId: string,
    workspaceId?: string,
    channel = 'all',
  ): Promise<InboxConversation[]> =>
    fetchWithAuth(
      `/api/v1/inbox/conversations${withScope({ tenantId, workspaceId, channel })}`,
    ),

  listInboxMessages: (
    tenantId: string,
    conversationId: string,
    workspaceId?: string,
  ): Promise<InboxMessage[]> =>
    fetchWithAuth(
      `/api/v1/inbox/messages${withScope({ tenantId, conversationId, workspaceId })}`,
    ),

  syncInbox: (tenantId: string, workspaceId?: string) =>
    fetchWithAuth('/api/v1/inbox/sync', {
      method: 'POST',
      body: JSON.stringify({ tenantId, workspaceId }),
    }),

  replyInbox: (
    tenantId: string,
    conversationId: string,
    message: string,
    workspaceId?: string,
  ) =>
    fetchWithAuth('/api/v1/inbox/messages/reply', {
      method: 'POST',
      body: JSON.stringify({ tenantId, conversationId, message, workspaceId }),
    }),
};
