import {
  getToken,
  getRefreshToken,
  saveToken,
  saveRefreshToken,
  getTenantId,
} from './auth-store';

export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

/** Same server OAuth entrypoint as web `client/src/lib/api.ts` getSocialLoginUrl. */
export function getSocialLoginUrl(
  provider: 'google' | 'facebook' | 'linkedin' | 'instagram' | 'twitter',
) {
  return `${API_URL.replace(/\/$/, '')}/api/v1/auth/${provider}`;
}

/** Mobile native Google sign-in via API redirect (uses api GOOGLE_CLIENT_ID, not expo client ids). */
export function getGoogleMobileAuthUrl(returnUrl: string) {
  const base = API_URL.replace(/\/$/, '');
  return `${base}/api/v1/auth/google/mobile?returnUrl=${encodeURIComponent(returnUrl)}`;
}

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
  campaignTheme?: string | null;
  status?: string | null;
  platforms?: string[] | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  publishedAt?: string | null;
  media?: Array<{ id?: string; url?: string; type?: string }>;
};

export type FormSuggestionForm = 'brand-brain' | 'content' | 'campaign' | 'whatsapp-menu';

export type BrandProfile = {
  id?: string;
  tenantId?: string;
  workspaceId?: string;
  brandType?: string;
  companyName?: string;
  industry?: string;
  description?: string;
  services?: string;
  targetAudience?: string;
  audiencePainPoints?: string;
  toneOfVoice?: string;
  brandPersonality?: string;
  currentOffers?: string;
  uniqueSellingPoints?: string;
  faqs?: string;
  caseStudies?: string;
  bannedWords?: string;
  bannedTopics?: string;
  competitors?: string;
  keywords?: string;
  websiteUrl?: string;
};

export type ContentCampaign = {
  id: string;
  name?: string;
  theme?: string;
  goal?: string;
  summary?: string;
  postCount?: number;
  startDate?: string;
  status?: string;
  platforms?: string[];
  created_at?: string;
};

export type CampaignDetail = {
  campaign: ContentCampaign;
  posts: Array<{
    id?: string;
    title?: string;
    content?: string;
    platforms?: string[];
    scheduledDate?: string;
    status?: string;
  }>;
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
  lastAt?: string;
  contentId?: string;
};

export type ReplyOutcome = {
  sent: boolean;
  message?: string;
  usedTemplate?: boolean;
};

export function assertReplySent(result: ReplyOutcome | null | undefined): ReplyOutcome {
  if (!result || result.sent !== true) {
    throw new Error(result?.message || 'Send failed');
  }
  return result;
}

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
  const data = errorData as { message?: string | string[]; error?: string | string[] };
  if (Array.isArray(data.message)) return data.message.join(', ');
  if (typeof data.message === 'string') return data.message;
  if (Array.isArray(data.error)) return data.error.join(', ');
  if (typeof data.error === 'string') return data.error;
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

export async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {},
  retried = false,
  timeoutMs = 10000,
) {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = await getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

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
        return fetchWithAuth(endpoint, options, true, timeoutMs);
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

  getTenantTheme: async (tenantId: string): Promise<Record<string, unknown> | null> => {
    return fetchPublic(`/api/v1/tenants/${tenantId}/theme`);
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
    retried = false,
  ): Promise<any> => {
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

      if (response.status === 401 && !retried) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          return api.uploadMedia(uri, tenantId, workspaceId, contentId, mimeType, fileName, true);
        }
        sessionHooks.onAuthFailure?.();
        throw new Error('Your session has expired. Please sign in again.');
      }

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

  getYoutubeSetup: (token: string) =>
    fetchWithAuth(
      `/api/v1/social-accounts/youtube/setup?token=${encodeURIComponent(token)}`,
    ),

  finalizeYoutube: (data: { setupToken: string; channelId: string }) =>
    fetchWithAuth('/api/v1/social-accounts/youtube/finalize', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getWhatsappSetup: (token: string) =>
    fetchWithAuth(
      `/api/v1/social-accounts/whatsapp/setup?token=${encodeURIComponent(token)}`,
    ),

  finalizeWhatsapp: (data: { setupToken: string; phoneNumberId: string }) =>
    fetchWithAuth('/api/v1/social-accounts/whatsapp/finalize', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  disconnectSocial: (id: string, tenantId?: string) =>
    fetchWithAuth(
      `/api/v1/social-accounts/${id}/disconnect${withScope({ tenantId })}`,
      { method: 'POST' },
    ),

  listInboxConversations: async (
    tenantId: string,
    workspaceId?: string,
    channel = 'all',
  ): Promise<InboxConversation[]> => {
    const data = await fetchWithAuth(
      `/api/v1/inbox/conversations${withScope({ tenantId, workspaceId, channel })}`,
    );
    if (Array.isArray(data)) return data as InboxConversation[];
    if (Array.isArray(data?.data)) return data.data as InboxConversation[];
    return [];
  },

  listInboxMessages: async (
    tenantId: string,
    conversationId: string,
    workspaceId?: string,
  ): Promise<InboxMessage[]> => {
    const data = await fetchWithAuth(
      `/api/v1/inbox/messages${withScope({ tenantId, conversationId, workspaceId })}`,
    );
    if (Array.isArray(data)) return data as InboxMessage[];
    return [];
  },

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
  ): Promise<ReplyOutcome> =>
    fetchWithAuth('/api/v1/inbox/messages/reply', {
      method: 'POST',
      body: JSON.stringify({ tenantId, conversationId, message, workspaceId }),
    }),

  commentRepliesInbox: (
    tenantId: string,
    workspaceId?: string,
    contentId?: string,
  ): Promise<{ posts?: any[] }> =>
    fetchWithAuth(
      `/api/v1/comment-replies/inbox${withScope({ tenantId, workspaceId, contentId })}`,
    ),

  fetchCommentReplies: (tenantId: string, workspaceId?: string) =>
    fetchWithAuth('/api/v1/comment-replies/fetch', {
      method: 'POST',
      body: JSON.stringify({ tenantId, workspaceId }),
    }),

  sendCommentReply: (
    commentId: string,
    message: string,
  ): Promise<ReplyOutcome> =>
    fetchWithAuth(`/api/v1/comment-replies/${commentId}/send`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),

  suggestCommentReply: (commentId: string) =>
    fetchWithAuth(`/api/v1/comment-replies/${commentId}/suggest`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  getFormSuggestions: (data: {
    tenantId: string;
    workspaceId?: string;
    form: FormSuggestionForm;
    fields?: string[];
    variationSeed?: string;
    refresh?: boolean;
    avoidTexts?: string[];
  }): Promise<{ suggestions: Record<string, string[]> }> =>
    fetchWithAuth('/api/v1/ai/form-suggestions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  enhanceField: (data: {
    tenantId: string;
    workspaceId?: string;
    form: FormSuggestionForm;
    fieldKey: string;
    currentValue?: string;
    variationSeed?: string;
    avoidTexts?: string[];
  }): Promise<{ text: string }> =>
    fetchWithAuth('/api/v1/ai/enhance-field', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  generateContent: (data: {
    theme?: string;
    draft?: string;
    workspaceId?: string;
    workspace_id?: string;
    tenantId?: string;
    contentType?: string;
    platform?: string;
    templateId?: string;
    save?: boolean;
  }) =>
    fetchWithAuth(
      '/api/v1/content-ai/generate',
      {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          // Match web client: generate into editor only; user saves draft explicitly.
          save: data.contentType === 'reply' ? false : data.save ?? false,
        }),
      },
      false,
      120000,
    ),

  getBrandProfileMine: (tenantId: string, workspaceId?: string): Promise<BrandProfile | null> =>
    fetchWithAuth(`/api/v1/brand-profiles/mine${withScope({ tenantId, workspaceId })}`),

  saveBrandProfile: (
    tenantId: string,
    workspaceId: string | undefined,
    body: Record<string, unknown>,
  ): Promise<BrandProfile> =>
    fetchWithAuth('/api/v1/brand-profiles', {
      method: 'POST',
      body: JSON.stringify({ tenantId, workspaceId, ...body }),
    }),

  updateBrandProfile: (id: string, body: Record<string, unknown>) =>
    fetchWithAuth(`/api/v1/brand-profiles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  listMedia: async (tenantId: string, workspaceId?: string) => {
    const data = await fetchWithAuth(`/api/v1/media${withScope({ tenantId, workspaceId })}`);
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  },

  listTemplates: async (tenantId: string, workspaceId?: string) => {
    const data = await fetchWithAuth(`/api/v1/templates${withScope({ tenantId, workspaceId })}`);
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    return [];
  },

  getTemplate: (id: string, tenantId: string) =>
    fetchWithAuth(`/api/v1/templates/${id}${withScope({ tenantId })}`),

  listCampaigns: async (tenantId: string, workspaceId?: string): Promise<ContentCampaign[]> => {
    const data = await fetchWithAuth(
      `/api/v1/content-campaigns${withScope({ tenantId, workspaceId })}`,
    );
    if (Array.isArray(data)) return data as ContentCampaign[];
    return [];
  },

  getCampaign: (id: string, tenantId: string): Promise<CampaignDetail> =>
    fetchWithAuth(`/api/v1/content-campaigns/${id}${withScope({ tenantId })}`),

  generateCampaign: (data: {
    tenantId: string;
    workspaceId: string;
    theme: string;
    name?: string;
    goal?: string;
    platforms?: string[];
    postCount?: number;
    startDate?: string;
  }): Promise<{ campaign: ContentCampaign; posts: CampaignDetail['posts'] }> =>
    fetchWithAuth(
      '/api/v1/content-campaigns/generate',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      false,
      180000,
    ),

  deleteCampaign: (id: string, tenantId: string) =>
    fetchWithAuth(`/api/v1/content-campaigns/${id}${withScope({ tenantId })}`, {
      method: 'DELETE',
    }),

  getPlatformDashboard: (tenantId: string, workspaceId?: string) =>
    fetchWithAuth(`/api/v1/analytics/platform-dashboard${withScope({ tenantId, workspaceId })}`),

  listTeamMembers: async (tenantId: string) => {
    const data = await fetchWithAuth(
      `/api/v1/tenant-members?tenantId=${encodeURIComponent(tenantId)}&detailed=true`,
    );
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    return [];
  },

  listApprovalRequests: async (
    tenantId: string,
    opts?: { status?: string; statuses?: string[] },
  ) => {
    const params = new URLSearchParams({ tenantId });
    if (opts?.status) params.set('status', opts.status);
    if (opts?.statuses?.length) params.set('statuses', opts.statuses.join(','));
    const data = await fetchWithAuth(`/api/v1/approval-requests?${params.toString()}`);
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    return [];
  },

  updateApprovalRequest: (id: string, body: Record<string, unknown>) =>
    fetchWithAuth(`/api/v1/approval-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  listLeads: async (tenantId: string, workspaceId?: string) => {
    const data = await fetchWithAuth(`/api/v1/leads${withScope({ tenantId, workspaceId })}`);
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.leads)) return data.leads;
    return [];
  },

  getLead: (id: string) => fetchWithAuth(`/api/v1/leads/${id}`),

  getGmailStatus: () =>
    fetchWithAuth('/api/v1/mail/gmail/status') as Promise<{
      connected: boolean;
      email?: string | null;
      smtpConfigured?: boolean;
      inboxAutoReply?: boolean;
    }>,

  listMailInbox: async (tenantId: string, workspaceId?: string, limit = 30) => {
    const params = new URLSearchParams({ tenantId, limit: String(limit) });
    if (workspaceId) params.set('workspaceId', workspaceId);
    const data = await fetchWithAuth(`/api/v1/mail/inbox?${params.toString()}`);
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    return [];
  },

  listRoles: async (tenantId: string) => {
    const data = await fetchWithAuth(`/api/v1/roles?tenantId=${encodeURIComponent(tenantId)}`);
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    return [];
  },

  getWhatsappStatus: (tenantId: string, workspaceId?: string) =>
    fetchWithAuth(`/api/v1/whatsapp/connection-status${withScope({ tenantId, workspaceId })}`) as Promise<{
      connected: boolean;
      displayPhoneNumber?: string;
      accountName?: string;
      message?: string;
      graphError?: string;
    }>,

  listAutoReplyRules: async (tenantId: string, workspaceId?: string) => {
    const data = await fetchWithAuth(`/api/v1/auto-reply-rules${withScope({ tenantId, workspaceId })}`);
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    return [];
  },

  updateAutoReplyRule: (id: string, body: Record<string, unknown>) =>
    fetchWithAuth(`/api/v1/auto-reply-rules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  forgotPassword: (email: string) =>
    fetch(`${API_URL}/api/v1/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(messageFromErrorBody(data, 'Request failed'));
      return data;
    }),
};
