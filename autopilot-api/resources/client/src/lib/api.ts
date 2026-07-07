// src/lib/api.ts
import type { UserRole } from './roles';
import { ApiError, reportApiFailure, reportApiSuccess } from './api-errors';
import { withWorkspace } from './workspace-query';

export { ApiError, isNetworkError, isAuthError } from './api-errors';

/** Resolves API base URL. Empty VITE_API_BASE_URL = same origin (Nest serves SPA or Vite dev proxy). */
export function resolveApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL as string | undefined;
  const configured = raw?.trim().replace(/^["']|["']$/g, '') ?? '';

  if (!configured) {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
    // Build time / SSR — use relative URLs in the browser at runtime
    return '';
  }

  if (configured.startsWith('//')) {
    if (typeof window !== 'undefined' && window.location?.protocol) {
      return `${window.location.protocol}${configured}`;
    }
    return `https:${configured}`;
  }
  return configured.replace(/\/$/, '');
}

export const API_BASE_URL = resolveApiBaseUrl();

// ----------------------------------------------------------------------
// Types (derived from the OpenAPI spec)
// ----------------------------------------------------------------------

export interface RefreshTokenDto {
    // Typically contains refreshToken string, but spec shows empty
    refreshToken?: string;
}

export interface TokenVerificationDto {
    token: string;
}

export interface SocialAccount {
    id: string;
    tenantId: string;
    userId: string;
    platform: string;
    accountName: string;
    externalId?: string;
    username?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: string;
    connected: boolean;
    metadata?: Record<string, unknown>;
}

export interface SocialAccountsCreateDto {
    tenantId: string;
    userId?: string;
    platform: string;
    accountName: string;
    externalId?: string;
    username?: string;
    accessToken: string;
    refreshToken?: string;
    expiresAt?: string;
    connected?: boolean;
    metadata?: Record<string, unknown>;
}

export interface AuthUser {
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    role?: UserRole;
    avatar?: string;
    phone?: string;
}

export interface TenantSummary {
    id: string;
    name: string;
    slug: string;
    ownerId: string;
}

export interface LoginPayload {
    user: AuthUser;
    token: string;
    refreshToken?: string;
    tenant?: TenantSummary;
}

export type AuthProfile = AuthUser & {
    tenant?: TenantSummary;
};

export interface TenantsCreateDto { }
export interface TenantsUpdateDto { }

export interface BrandProfilesCreateDto {
    tenantId: string;
    workspaceId?: string;
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
}
export interface BrandProfilesUpdateDto { }

export interface ContentItemsCreateDto { }
export interface ContentItemsUpdateDto { }

export interface LeadsCreateDto { }
export interface LeadsUpdateDto { }

export interface LeadSourcesCreateDto { }
export interface LeadSourcesUpdateDto { }

export interface PaymentFailuresCreateDto { }
export interface PaymentFailuresUpdateDto { }

export interface DepositsCreateDto { }
export interface DepositsUpdateDto { }

export interface ApprovalRequestsCreateDto { }
export interface ApprovalRequestsUpdateDto { }

export interface AutoReplyRulesCreateDto { }
export interface AutoReplyRulesUpdateDto { }

export interface WhatsappContactsCreateDto { }
export interface WhatsappContactsUpdateDto { }

export interface CommentRepliesCreateDto { }
export interface CommentRepliesUpdateDto { }

export interface AuditLogsCreateDto { }
export interface AuditLogsUpdateDto { }

export interface AiUsageCreateDto { }
export interface AiUsageUpdateDto { }

// Common response shape (adjust based on your actual backend)
export interface ApiResponse<T = any> {
    data?: T;
    message?: string;
    statusCode?: number;
}

// ----------------------------------------------------------------------
// Auth token management (customize as needed)
// ----------------------------------------------------------------------
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
    authToken = token;
    if (token) {
        localStorage.setItem('access_token', token);
    } else {
        localStorage.removeItem('access_token');
    }
}

export function getAuthToken(): string | null {
    if (authToken) return authToken;
    return localStorage.getItem('access_token');
}

export function setRefreshToken(token: string | null) {
    if (token) {
        localStorage.setItem('refresh_token', token);
    } else {
        localStorage.removeItem('refresh_token');
    }
}

export function getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
}

export function getSocialLoginUrl(provider: 'google' | 'facebook' | 'linkedin' | 'instagram') {
    const base = resolveApiBaseUrl().replace(/\/$/, '');
    return base ? `${base}/api/v1/auth/${provider}` : `/api/v1/auth/${provider}`;
}

// ----------------------------------------------------------------------
// Base fetch helper
// ----------------------------------------------------------------------
interface FetchOptions extends RequestInit {
    requireAuth?: boolean;
    /** @internal retry after token refresh */
    _isRetry?: boolean;
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
    if (refreshInFlight) return refreshInFlight;

    refreshInFlight = (async () => {
        const refreshToken = getRefreshToken();
        if (!refreshToken) return null;

        try {
            const response = await fetch(`${resolveApiBaseUrl()}/api/v1/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken }),
            });
            if (!response.ok) return null;

            const body = await response.json() as { accessToken?: string; token?: string };
            const next = body.accessToken ?? body.token ?? null;
            if (next) setAuthToken(next);
            return next;
        } catch {
            return null;
        } finally {
            refreshInFlight = null;
        }
    })();

    return refreshInFlight;
}

async function request<T>(
    endpoint: string,
    options: FetchOptions = {}
): Promise<T> {
    const { requireAuth = true, headers = {}, ...rest } = options;

    const requestHeaders: HeadersInit = {
        'Content-Type': 'application/json',
        ...headers,
    };

    if (requireAuth) {
        const token = getAuthToken();
        if (!token) {
            throw new ApiError('No authentication token available', { status: 401, isAuthError: true });
        }
        requestHeaders['Authorization'] = `Bearer ${token}`;
    }

    let response: Response;
    try {
        response = await fetch(`${resolveApiBaseUrl()}${endpoint}`, {
            ...rest,
            headers: requestHeaders,
        });
    } catch (err) {
        reportApiFailure(err);
        throw new ApiError(
            'Unable to reach the server. Check your connection or try again when the API is running.',
            { isNetworkError: true },
        );
    }

    if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
            const errorBody = await response.json();
            errorMessage = errorBody.message || errorBody.error || errorMessage;
        } catch {
            // ignore non-JSON error bodies
        }
        const isAuthError = response.status === 401 || response.status === 403;

        if (isAuthError && requireAuth && !options._isRetry) {
            const refreshed = await refreshAccessToken();
            if (refreshed) {
                return request<T>(endpoint, { ...options, _isRetry: true });
            }
            setAuthToken(null);
        }

        throw new ApiError(errorMessage, { status: response.status, isAuthError });
    }

    reportApiSuccess();

    // Handle 204 No Content
    if (response.status === 204) {
        return undefined as T;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
        throw new ApiError(
            'Server returned a non-JSON response (often a cached app page). Hard-refresh or clear site data, then retry.',
            { status: response.status },
        );
    }

    try {
        return (await response.json()) as T;
    } catch {
        throw new ApiError('Invalid response from server', { status: response.status });
    }
}

// ----------------------------------------------------------------------
// API functions grouped by OpenAPI tags
// ----------------------------------------------------------------------

// ==================== Auth ====================
export const authApi = {
    // POST /api/v1/auth/refresh
    refreshToken: (data: RefreshTokenDto) =>
        request<any>('/api/v1/auth/refresh', {
            method: 'POST',
            body: JSON.stringify(data),
            requireAuth: false, // Usually refresh is called before token expires
        }),

    register: (data: { email: string; password: string; firstName?: string; lastName?: string }) =>
        request<any>('/api/v1/auth/register', {
            method: 'POST',
            body: JSON.stringify(data),
            requireAuth: false,
        }),

    login: (data: { email: string; password: string }) =>
        request<any>('/api/v1/auth/login', {
            method: 'POST',
            body: JSON.stringify(data),
            requireAuth: false,
        }),

    requestPasswordReset: (email: string) =>
        request<any>('/api/v1/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email }),
            requireAuth: false,
        }),

    resetPassword: (token: string, newPassword: string) =>
        request<any>('/api/v1/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ token, newPassword }),
            requireAuth: false,
        }),

    // POST /api/v1/auth/logout
    logout: () =>
        request<void>('/api/v1/auth/logout', { method: 'POST' }),

    // GET /api/v1/auth/me
    getMe: () => request<any>('/api/v1/auth/me'),

    // GET /api/v1/auth/google
    googleAuth: () => request<any>('/api/v1/auth/google', { requireAuth: false }),

    // GET /api/v1/auth/google/redirect
    googleAuthRedirect: (state: string) =>
        request<any>(`/api/v1/auth/google/redirect?state=${encodeURIComponent(state)}`, {
            requireAuth: false,
        }),

    // POST /api/v1/auth/google-auth
    googleAuthenticate: (data: TokenVerificationDto) =>
        request<any>('/api/v1/auth/google-auth', {
            method: 'POST',
            body: JSON.stringify(data),
            requireAuth: false,
        }),

    // GET /api/v1/auth/facebook
    facebookLogin: () => request<any>('/api/v1/auth/facebook', { requireAuth: false }),

    // GET /api/v1/auth/facebook/redirect
    facebookLoginRedirect: (state: string) =>
        request<any>(`/api/v1/auth/facebook/redirect?state=${encodeURIComponent(state)}`, {
            requireAuth: false,
        }),

    // POST /api/v1/auth/facebook-auth
    facebookAuthenticate: (data: TokenVerificationDto) =>
        request<any>('/api/v1/auth/facebook-auth', {
            method: 'POST',
            body: JSON.stringify(data),
            requireAuth: false,
        }),

    // GET /api/v1/auth/linkedin
    linkedInLogin: () => request<any>('/api/v1/auth/linkedin', { requireAuth: false }),

    // GET /api/v1/auth/linkedin/redirect
    linkedInLoginRedirect: (code: string, state: string) =>
        request<any>(
            `/api/v1/auth/linkedin/redirect?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
            { requireAuth: false }
        ),

    // POST /api/v1/auth/linkedin-auth
    linkedInAuthenticate: (data: TokenVerificationDto) =>
        request<any>('/api/v1/auth/linkedin-auth', {
            method: 'POST',
            body: JSON.stringify(data),
            requireAuth: false,
        }),

    // GET /api/v1/auth/instagram
    instagramLogin: () => request<any>('/api/v1/auth/instagram', { requireAuth: false }),

    // GET /api/v1/auth/instagram/redirect
    instagramLoginRedirect: (code: string, state: string) =>
        request<any>(
            `/api/v1/auth/instagram/redirect?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
            { requireAuth: false }
        ),

    // POST /api/v1/auth/instagram-auth
    instagramAuthenticate: (data: TokenVerificationDto) =>
        request<any>('/api/v1/auth/instagram-auth', {
            method: 'POST',
            body: JSON.stringify(data),
            requireAuth: false,
        }),
};

// ==================== Users ====================
export const usersApi = {
    getUsers: (order: 'ASC' | 'DESC' = 'ASC', page: number = 1, take: number = 10) =>
        request<any>(`/api/v1/users?order=${order}&page=${page}&take=${take}`),
};

// ==================== Social Accounts ====================
export const socialAccountsApi = {
    connect: (data: SocialAccountsCreateDto) =>
        request<any>('/api/v1/social-accounts/connect', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    findByTenant: (tenantId: string, workspaceId?: string) => {
        const qs = withWorkspace(new URLSearchParams(), workspaceId);
        const q = qs.toString();
        return request<SocialAccount[]>(
            `/api/v1/social-accounts/tenant/${tenantId}${q ? `?${q}` : ''}`,
        );
    },

    startOAuth: (platform: string, tenantId: string, returnUrl: string, workspaceId?: string) => {
        const qs = withWorkspace(
            new URLSearchParams({
                tenantId,
                returnUrl,
            }),
            workspaceId,
        );
        return request<{ redirectUrl: string }>(
            `/api/v1/social-accounts/oauth/${platform}/authorize?${qs}`,
        );
    },

    getFacebookSetup: (token: string) =>
        request<{ pages: Array<{ id: string; name: string; category?: string }>; profileName?: string }>(
            `/api/v1/social-accounts/facebook/setup?token=${encodeURIComponent(token)}`,
        ),

    finalizeFacebook: (data: { setupToken: string; pageId: string }) =>
        request<SocialAccount>('/api/v1/social-accounts/facebook/finalize', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getYoutubeSetup: (token: string) =>
        request<{
            channels: Array<{ id: string; title: string; customUrl?: string; thumbnailUrl?: string }>;
            profileName?: string;
        }>(`/api/v1/social-accounts/youtube/setup?token=${encodeURIComponent(token)}`),

    finalizeYoutube: (data: { setupToken: string; channelId: string }) =>
        request<SocialAccount>('/api/v1/social-accounts/youtube/finalize', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getWhatsappSetup: (token: string) =>
        request<{ phones: Array<{ id: string; displayPhoneNumber?: string; verifiedName?: string; wabaId: string; wabaName?: string }> }>(
            `/api/v1/social-accounts/whatsapp/setup?token=${encodeURIComponent(token)}`,
        ),

    setupWhatsappFromMeta: (tenantId: string, workspaceId?: string) => {
        const qs = withWorkspace(new URLSearchParams({ tenantId }), workspaceId);
        return request<
            | {
                  ready: true;
                  setupToken: string;
                  phones: Array<{ id: string; displayPhoneNumber?: string; verifiedName?: string; wabaId: string; wabaName?: string }>;
                  source: 'facebook';
              }
            | { ready: false; needOAuth: true; reason: 'no_facebook' | 'missing_scopes' | 'no_phones' }
        >(`/api/v1/social-accounts/whatsapp/setup-from-meta?${qs}`, {
            method: 'POST',
        });
    },

    enablePlatformWhatsapp: (tenantId: string, workspaceId?: string) => {
        const qs = withWorkspace(new URLSearchParams({ tenantId }), workspaceId);
        return request<SocialAccount>(
            `/api/v1/social-accounts/whatsapp/enable-platform?${qs}`,
            { method: 'POST' },
        );
    },

    finalizeWhatsapp: (data: { setupToken: string; phoneNumberId: string }) =>
        request<any>('/api/v1/social-accounts/whatsapp/finalize', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getMyAccounts: () => request<any>('/api/v1/social-accounts/me'),

    disconnect: (id: string, tenantId?: string) =>
        request<any>(
            `/api/v1/social-accounts/${id}/disconnect${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''}`,
            { method: 'POST' },
        ),

    remove: (id: string, tenantId?: string) =>
        request<any>(
            `/api/v1/social-accounts/${id}${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''}`,
            { method: 'DELETE' },
        ),
};

// ==================== Tenants ====================
export const backofficeApi = {
    getOverview: () =>
        request<{
            company: {
                name: string;
                product: string;
                tagline: string;
                description: string;
                operator: string;
                region: string;
                supportEmail: string;
                website: string;
                legal: { privacy: string; terms: string; dataDeletion: string };
            };
            stats: {
                tenants: number;
                users: number;
                activeMembers: number;
                contentItems: number;
                publications: number;
                connectedSocialAccounts: number;
                leads: number;
                auditLogs: number;
                commentReplies: number;
                pendingDataDeletions: number;
                estimatedMrrZmw: number;
                revenueTotalZmw: number;
                aiTokensLastPeriod: number;
                chatbotConfigs: number;
                widgetsEnabled: number;
                chatSessions: number;
                chatSessionsLast7Days: number;
                chatMessages: number;
                knowledgeDocuments: number;
                knowledgeReady: number;
                knowledgeFailed: number;
                knowledgeChunks: number;
                activeChatbotApiKeys: number;
                ragEnabledTenants: number;
                mistralLibraryTenants: number;
                ttsEnabledTenants: number;
            };
            chatbot: {
                sessionsByChannel: Record<string, number>;
                knowledgeByStatus: Record<string, number>;
                aiTokensChatbot: number;
            };
            planDistribution: Record<string, number>;
            aiByFunction: Record<string, number>;
            tenantGrowth: Array<{ month: string; count: number }>;
            recentDeposits: Array<{
                id: string;
                tenantId: string;
                plan?: string;
                status?: string;
                amount?: string;
                currency?: string;
                createdAt: string;
            }>;
            recentTenants: Array<{
                id: string;
                name: string;
                slug: string;
                ownerEmail?: string;
                createdAt: string;
            }>;
            recentAudit: Array<{
                id: string;
                action: string;
                resourceType: string;
                tenantName?: string;
                userEmail?: string;
                createdAt: string;
            }>;
            dataDeletionRequests: Array<{
                id: string;
                platform: string;
                status: string;
                email?: string;
                createdAt: string;
            }>;
            crons: { autoPublish: boolean; dailyWorkflow: boolean; commentSync: boolean };
            env: {
                nodeEnv: string;
                apiPublicUrl: string;
                clientUrl: string;
                supabaseConfigured: boolean;
                mistralConfigured: boolean;
                metaConfigured: boolean;
                linkedInConfigured: boolean;
                pawapayConfigured: boolean;
                metaWebhookTokenSet: boolean;
                widgetBundleConfigured: boolean;
            };
        }>('/api/v1/backoffice/overview'),

    listTenants: () =>
        request<
            Array<{
                id: string;
                name: string;
                slug: string;
                ownerId: string;
                ownerEmail?: string;
                plan: string;
                status: string;
                members: number;
                contentItems: number;
                widgetEnabled: boolean;
                ragEnabled: boolean;
                chatSessions: number;
                createdAt: string;
            }>
        >('/api/v1/backoffice/tenants'),

    getTenant: (id: string) =>
        request<{
            id: string;
            name: string;
            slug: string;
            logoUrl?: string;
            ownerId: string;
            ownerEmail?: string;
            createdAt: string;
            subscription: { plan: string; status: string; billingPeriodEnd: string | null };
            stats: { members: number; contentItems: number; publications: number; leads: number; aiTokens: number };
            chatbot: {
                name: string;
                widgetEnabled: boolean;
                ragEnabled: boolean;
                useMistralLibrary: boolean;
                widgetTtsEnabled: boolean;
                isActive: boolean;
                sessions: number;
                sessionsLast7Days: number;
                messages: number;
                knowledgeDocuments: number;
                knowledgeReady: number;
                knowledgeFailed: number;
                knowledgeChunks: number;
                activeApiKeys: number;
                sessionsByChannel: Record<string, number>;
            } | null;
            socialAccounts: Array<{ id: string; platform: string; connected: boolean; accountName: string }>;
            recentDeposits: Array<{
                id: string;
                plan?: string;
                amount?: string;
                currency?: string;
                status?: string;
                createdAt: string;
            }>;
        }>(`/api/v1/backoffice/tenants/${id}`),

    getPlans: () => request<PublicPlan[]>('/api/v1/backoffice/plans'),

    updatePlans: (data: Partial<Record<PublicPlan['key'], Partial<Omit<PublicPlan, 'key'>>>>) =>
        request<PublicPlan[]>('/api/v1/backoffice/plans', {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),
};

export const tenantsApi = {
    create: (data: { name: string; slug: string; ownerId: string; logoUrl?: string }) =>
        request<any>('/api/v1/tenants', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    findMine: () => request<any[]>('/api/v1/tenants/mine'),

    findAll: () => request<any[]>('/api/v1/tenants'),

    findOne: (id: string) => request<any>(`/api/v1/tenants/${id}`),

    update: (id: string, data: Record<string, unknown>) =>
        request<any>(`/api/v1/tenants/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    remove: (id: string) =>
        request<any>(`/api/v1/tenants/${id}`, { method: 'DELETE' }),
};

export const rbacApi = {
    hasRoles: async (tenantId: string, userId: string, roles: string) => {
        const res = await request<{ hasRole: boolean }>(
            `/api/v1/rbac/roles/check/${tenantId}/${userId}?roles=${encodeURIComponent(roles)}`
        );
        return res.hasRole;
    },

    hasPermission: async (tenantId: string, userId: string, permission: string) => {
        const res = await request<{ hasPermission: boolean }>(
            `/api/v1/rbac/permissions/check/${tenantId}/${userId}?permission=${encodeURIComponent(permission)}`
        );
        return res.hasPermission;
    },

    getEffectivePermissions: (tenantId: string, userId: string) =>
        request<{
            permissions: string[];
            isSystemAdmin: boolean;
            isSuperAdmin?: boolean;
            roleId: string | null;
            roleName: string | null;
        }>(`/api/v1/rbac/effective-permissions/${tenantId}/${userId}`),
};

export const rolesApi = {
    create: (data: { tenantId: string; name: string; description?: string; isSystem?: boolean }) =>
        request<any>('/api/v1/roles', { method: 'POST', body: JSON.stringify(data) }),
    findAll: (tenantId?: string) =>
        request<any[]>(`/api/v1/roles${tenantId ? `?tenantId=${tenantId}` : ''}`),
    findOne: (id: string) => request<any>(`/api/v1/roles/${id}`),
    update: (id: string, data: Record<string, unknown>) =>
        request<any>(`/api/v1/roles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => request<any>(`/api/v1/roles/${id}`, { method: 'DELETE' }),
};

export const permissionsApi = {
    findAll: () => request<any[]>('/api/v1/permissions'),
    findOne: (key: string) => request<any>(`/api/v1/permissions/${encodeURIComponent(key)}`),
    create: (data: { key: string; label: string; description?: string; module?: string }) =>
        request<any>('/api/v1/permissions', { method: 'POST', body: JSON.stringify(data) }),
    update: (key: string, data: { label?: string; description?: string; module?: string }) =>
        request<any>(`/api/v1/permissions/${encodeURIComponent(key)}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),
    remove: (key: string) =>
        request<any>(`/api/v1/permissions/${encodeURIComponent(key)}`, { method: 'DELETE' }),
};

export const systemSettingsApi = {
    getTheme: () => request<Record<string, string>>('/api/v1/system-settings/theme'),
    findAll: () => request<any[]>('/api/v1/system-settings'),
    findOne: (key: string) => request<any>(`/api/v1/system-settings/${encodeURIComponent(key)}`),
    upsert: (key: string, data: { value: Record<string, unknown>; description?: string }) =>
        request<any>(`/api/v1/system-settings/${encodeURIComponent(key)}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),
};

export const rolePermissionsApi = {
    findAll: () => request<any[]>('/api/v1/role-permissions'),
    create: (data: { roleId: string; permissionKey: string }) =>
        request<any>('/api/v1/role-permissions', { method: 'POST', body: JSON.stringify(data) }),
    remove: (roleId: string, permissionKey: string) =>
        request<any>(
            `/api/v1/role-permissions/${roleId}?permissionKey=${encodeURIComponent(permissionKey)}`,
            { method: 'DELETE' },
        ),
};

export const userPermissionsApi = {
    findAll: (tenantId?: string, userId?: string) => {
        const params = new URLSearchParams();
        if (tenantId) params.set('tenantId', tenantId);
        if (userId) params.set('userId', userId);
        const qs = params.toString();
        return request<any[]>(`/api/v1/user-permissions${qs ? `?${qs}` : ''}`);
    },
    create: (data: {
        tenantId: string;
        userId: string;
        permissionKey: string;
        effect: 'allow' | 'deny';
        grantedBy: string;
        reason?: string;
    }) => request<any>('/api/v1/user-permissions', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
        request<any>(`/api/v1/user-permissions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => request<any>(`/api/v1/user-permissions/${id}`, { method: 'DELETE' }),
};

export const tenantMembersApi = {
    invite: (data: { email: string; tenantId: string; roleId: string }) =>
        request<any>('/api/v1/tenant-members/invite', { method: 'POST', body: JSON.stringify(data) }),
    findAll: (tenantId?: string, detailed = false) => {
        const params = new URLSearchParams();
        if (tenantId) params.set('tenantId', tenantId);
        if (detailed) params.set('detailed', 'true');
        const qs = params.toString();
        return request<any[]>(`/api/v1/tenant-members${qs ? `?${qs}` : ''}`);
    },
    findMine: () => request<any[]>('/api/v1/tenant-members/me'),
    create: (data: Record<string, unknown>) =>
        request<any>('/api/v1/tenant-members', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
        request<any>(`/api/v1/tenant-members/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    revokeInvitation: (id: string, tenantId: string) =>
        request<any>(`/api/v1/tenant-members/invitations/${id}?tenantId=${encodeURIComponent(tenantId)}`, {
            method: 'DELETE',
        }),
    remove: (id: string) => request<any>(`/api/v1/tenant-members/${id}`, { method: 'DELETE' }),
};

export const profilesApi = {
    findAll: () => request<any[]>('/api/v1/profiles'),
    findByUser: (userId: string) =>
        request<any[]>(`/api/v1/profiles?userId=${userId}`),
    update: (id: string, data: Record<string, unknown>) =>
        request<any>(`/api/v1/profiles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};

export const workspacesApi = {
    findAll: (tenantId?: string) =>
        request<any[]>(`/api/v1/workspaces${tenantId ? `?tenantId=${tenantId}` : ''}`),
    create: (data: { tenantId: string; name: string; slug: string; logoUrl?: string }) =>
        request<any>('/api/v1/workspaces', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
        request<any>(`/api/v1/workspaces/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => request<any>(`/api/v1/workspaces/${id}`, { method: 'DELETE' }),
};

export const approvalWorkflowsApi = {
    findAll: (tenantId?: string) =>
        request<any[]>(`/api/v1/approval-workflows${tenantId ? `?tenantId=${tenantId}` : ''}`),
    update: (id: string, data: Record<string, unknown>) =>
        request<any>(`/api/v1/approval-workflows/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};

// ==================== Brand Profiles ====================
export const brandProfilesApi = {
    create: (data: BrandProfilesCreateDto) =>
        request<any>('/api/v1/brand-profiles', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    findAll: (tenantId?: string) =>
        request<any>(tenantId ? `/api/v1/brand-profiles?tenantId=${tenantId}` : '/api/v1/brand-profiles'),

    getMine: (tenantId: string, workspaceId?: string) => {
        const params = new URLSearchParams({ tenantId });
        if (workspaceId) params.set('workspaceId', workspaceId);
        return request<any | null>(`/api/v1/brand-profiles/mine?${params.toString()}`);
    },

    /** Creates or updates the profile for the current user + tenant (safe to call repeatedly). */
    save: (data: BrandProfilesCreateDto) =>
        request<any>('/api/v1/brand-profiles', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    findOne: (id: string) => request<any>(`/api/v1/brand-profiles/${id}`),

    update: (id: string, data: BrandProfilesUpdateDto) =>
        request<any>(`/api/v1/brand-profiles/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    remove: (id: string) =>
        request<any>(`/api/v1/brand-profiles/${id}`, { method: 'DELETE' }),

    scrapeWebsite: (data: { url: string; tenantId: string }) =>
        request<Record<string, string>>('/api/v1/brand-profiles/scrape-website', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    parseDocument: (file: File, tenantId: string, workspaceId?: string) => {
        const form = new FormData();
        form.append('file', file);
        form.append('tenantId', tenantId);
        if (workspaceId) form.append('workspaceId', workspaceId);
        const token = getAuthToken();
        return fetch(`${API_BASE_URL}/api/v1/brand-profiles/parse-document`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: form,
        }).then(async (res) => {
            if (!res.ok) {
                let msg = `HTTP ${res.status}`;
                try {
                    const body = await res.json();
                    msg = body.message || msg;
                } catch { /* ignore */ }
                throw new Error(msg);
            }
            return res.json() as Promise<Record<string, string>>;
        });
    },
};

// ==================== Queue Jobs ====================
export type QueueJobStatus = {
    id: string;
    queue: string;
    name: string;
    state: string;
    progress?: number;
    data?: unknown;
    returnvalue?: unknown;
    failedReason?: string;
    attemptsMade?: number;
    maxAttempts?: number;
    timestamp?: number;
    finishedOn?: number;
};

export type QueuedJobResponse = {
    queued?: boolean;
    jobId?: string | number;
    queue?: string;
};

export const queueJobsApi = {
    getStatus: (queue: string, jobId: string | number) =>
        request<QueueJobStatus | null>(`/api/v1/queues/${encodeURIComponent(queue)}/jobs/${encodeURIComponent(String(jobId))}`),

    listQueues: () =>
        request<{ queues: string[]; enabled: boolean }>('/api/v1/queues/queues'),

    getStats: (queue: string) =>
        request<Record<string, number>>(`/api/v1/queues/${encodeURIComponent(queue)}/stats`),

    listJobs: (
        queue: string,
        params?: { state?: string; start?: number; end?: number },
    ) => {
        const search = new URLSearchParams();
        if (params?.state) search.set('state', params.state);
        if (params?.start != null) search.set('start', String(params.start));
        if (params?.end != null) search.set('end', String(params.end));
        const qs = search.toString();
        return request<QueueJobStatus[]>(
            `/api/v1/queues/${encodeURIComponent(queue)}/jobs${qs ? `?${qs}` : ''}`,
        );
    },

    retryJob: (queue: string, jobId: string | number) =>
        request<QueueJobStatus>(
            `/api/v1/queues/${encodeURIComponent(queue)}/jobs/${encodeURIComponent(String(jobId))}/retry`,
            { method: 'POST' },
        ),

    retryAllFailed: (queue: string, limit = 100) =>
        request<{ retried: number }>(
            `/api/v1/queues/${encodeURIComponent(queue)}/retry-failed?limit=${limit}`,
            { method: 'POST' },
        ),
};

export async function retryQueueJob(queue: string, jobId: string | number) {
    await queueJobsApi.retryJob(queue, jobId);
    return waitForQueueJob(queue, jobId);
}

export async function waitForQueueJob(
    queue: string,
    jobId: string | number,
    opts?: { intervalMs?: number; timeoutMs?: number },
): Promise<unknown> {
    const intervalMs = opts?.intervalMs ?? 1500;
    const timeoutMs = opts?.timeoutMs ?? 180000;
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
        const status = await queueJobsApi.getStatus(queue, jobId);
        if (!status) throw new Error('Background job not found');
        if (status.state === 'completed') {
            if (status.returnvalue == null && status.name === 'ai-task') {
                throw new Error(
                    'Background job completed without a result. Restart the API server and try again.',
                );
            }
            return status.returnvalue;
        }
        if (status.state === 'failed') {
            throw new Error(status.failedReason || 'Background job failed');
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    throw new Error('Background job timed out');
}

export async function resolveQueued<T>(response: T & QueuedJobResponse): Promise<unknown> {
    if (response?.queued && response.jobId != null && response.queue) {
        return waitForQueueJob(response.queue, response.jobId);
    }
    return response;
}

// ==================== Content AI (Mistral) ====================
export const contentAiApi = {
    generate: (data: {
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
        request<{ title: string; content: string; contentItemId?: string }>(
            '/api/v1/content-ai/generate',
            { method: 'POST', body: JSON.stringify(data) },
        ),

    repurpose: (contentId: string) =>
        request<{ repurposed: number }>('/api/v1/content-ai/repurpose', {
            method: 'POST',
            body: JSON.stringify({ contentId }),
        }),

    adaptPlatforms: (data: {
        tenantId: string;
        platforms: string[];
        content: string;
        title?: string;
        workspaceId?: string;
    }) =>
        request<{ payloads: Record<string, { title: string; content: string }>; tokensUsed: number }>(
            '/api/v1/content-ai/adapt-platforms',
            { method: 'POST', body: JSON.stringify(data) },
        ),

    generateImage: (data: { prompt: string; tenantId: string; contentId?: string; contentType?: string }) =>
        request<{ media_url: string; media_type: string; mediaAssetId: string }>(
            '/api/v1/content-ai/generate-image',
            { method: 'POST', body: JSON.stringify(data) },
        ),

    generateSlideshow: (data: { theme: string; tenantId: string; slideCount?: number; contentId?: string }) =>
        request<{ slides: string[] }>('/api/v1/content-ai/generate-slideshow', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    publish: (
        contentId: string,
        platforms?: string[],
        platformPayloads?: Record<string, unknown>,
        opts?: { contentType?: string },
    ) =>
        request<
            QueuedJobResponse & {
                message?: string;
                published?: boolean;
                results?: Record<string, { published: boolean; message: string }>;
            }
        >(`/api/v1/content-ai/${contentId}/publish`, {
            method: 'POST',
            body: JSON.stringify({
                platforms,
                platformPayloads,
                contentType: opts?.contentType,
            }),
        }),

    autoPublish: () =>
        request<{ attempted: number; published: number; failed: number; errors: string[] }>(
            '/api/v1/content-ai/auto-publish',
            { method: 'POST', body: JSON.stringify({}) },
        ),

    dailyWorkflow: (tenantId?: string, workspaceId?: string) =>
        request<{ generated: number; skipped?: number; errors: string[] }>(
            '/api/v1/content-ai/daily-workflow',
            { method: 'POST', body: JSON.stringify({ tenantId, workspaceId }) },
        ),
};

export const contentCampaignsApi = {
    generate: (data: {
        tenantId: string;
        workspaceId: string;
        theme: string;
        name?: string;
        goal?: string;
        platforms?: string[];
        postCount?: number;
        startDate?: string;
    }) =>
        request<{ campaign: Record<string, unknown>; posts: Record<string, unknown>[] }>(
            '/api/v1/content-campaigns/generate',
            { method: 'POST', body: JSON.stringify(data) },
        ),

    list: (tenantId: string, workspaceId?: string) => {
        const qs = new URLSearchParams({ tenantId });
        if (workspaceId) qs.set('workspaceId', workspaceId);
        return request<Record<string, unknown>[]>(`/api/v1/content-campaigns?${qs}`);
    },

    getOne: (id: string, tenantId: string) =>
        request<{ campaign: Record<string, unknown>; posts: Record<string, unknown>[] }>(
            `/api/v1/content-campaigns/${id}?tenantId=${tenantId}`,
        ),

    remove: (id: string, tenantId: string) =>
        request<{ deleted: boolean }>(`/api/v1/content-campaigns/${id}?tenantId=${tenantId}`, {
            method: 'DELETE',
        }),
};

export type SubscriptionSummary = {
    plan: string;
    status: string;
    dailyWorkflowEnabled: boolean;
    aiCallsLimit: number | null;
    aiCallsUsed: number;
    aiCallsRemaining: number | null;
    seatLimit: number | null;
    billingPeriodStart: string;
    billingPeriodEnd: string;
    autoRenewEnabled: boolean;
    renewalPhone: string | null;
    renewalCorrespondent: string | null;
    hasRenewalMethod: boolean;
};

export const subscriptionsApi = {
    getForTenant: (tenantId: string) =>
        request<SubscriptionSummary>(`/api/v1/subscriptions/tenant/${tenantId}`),
    setAutoRenew: (tenantId: string, enabled: boolean) =>
        request<SubscriptionSummary>(
            `/api/v1/subscriptions/tenant/${tenantId}/auto-renew`,
            { method: 'PATCH', body: JSON.stringify({ enabled }) },
        ),
};

export type PublicPlan = {
    key: 'free' | 'starter' | 'pro';
    label: string;
    priceZmw: number;
    aiCallsLimit: number | null;
    seatLimit: number | null;
    tenantLimit: number | null;
    dailyWorkflowEnabled: boolean;
    features: string[];
    highlight: boolean;
};

function optionalAuthHeaders(): HeadersInit {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export const legalApi = {
    recordConsent: (data: { visitorId: string; consentVersion?: string }) =>
        request<{
            id: string;
            visitorId: string;
            userId: string | null;
            consentVersion: string;
            accepted: boolean;
            createdAt: string;
        }>('/api/v1/legal/data-protection/consent', {
            method: 'POST',
            requireAuth: false,
            headers: optionalAuthHeaders(),
            body: JSON.stringify(data),
        }),
    consentStatus: (visitorId: string, version?: string) => {
        const params = new URLSearchParams({ visitorId });
        if (version) params.set('version', version);
        return request<{ accepted: boolean; id?: string; createdAt?: string }>(
            `/api/v1/legal/data-protection/consent?${params}`,
            { requireAuth: false },
        );
    },
    requestDataDeletion: (email: string) =>
        request<{
            id: string;
            confirmationCode: string;
            status: string;
            createdAt: string;
        }>('/api/v1/legal/data-deletion-request', {
            method: 'POST',
            requireAuth: false,
            headers: optionalAuthHeaders(),
            body: JSON.stringify({ email }),
        }),
    deletionStatus: (code: string) =>
        request<{
            id: string;
            confirmationCode: string;
            status: string;
            platform: string;
            email: string | null;
            completedAt: string | null;
            createdAt: string;
        }>(`/api/v1/legal/deletion-status?code=${encodeURIComponent(code)}`, { requireAuth: false }),
};

export const plansApi = {
    list: () => request<PublicPlan[]>('/api/v1/plans', { requireAuth: false }),
};

export const paymentsApi = {
    initiateDeposit: (data: { tenantId: string; plan: string; phone?: string; correspondent?: string }) =>
        request<{ paymentId: string; status: string; message: string; plan?: string; amount?: string; activated?: boolean }>(
            '/api/v1/payments/deposits/initiate',
            { method: 'POST', body: JSON.stringify(data) },
        ),
    initiateAdsDeposit: (data: { tenantId: string; amount: number; phone?: string; correspondent?: string }) =>
        request<{ paymentId: string; status: string; message: string; plan?: string; amount?: string; activated?: boolean }>(
            '/api/v1/payments/ads-deposit',
            { method: 'POST', body: JSON.stringify(data) },
        ),
    listDeposits: (tenantId: string) =>
        request<Array<{
            id: string;
            invoiceNumber: string;
            plan: string | null;
            status: string | null;
            amount: string | null;
            currency: string | null;
            method: 'mobile_money';
            network: string | null;
            phone: string | null;
            createdAt: string;
            paidAt: string | null;
            canDownloadInvoice: boolean;
        }>>(`/api/v1/payments/deposits/tenant/${tenantId}`),
    downloadInvoice: async (tenantId: string, depositId: string, view = false) => {
        const token = getAuthToken();
        if (!token) throw new ApiError('Not authenticated', { status: 401, isAuthError: true });
        const response = await fetch(
            `${API_BASE_URL}/api/v1/payments/deposits/${encodeURIComponent(depositId)}/invoice?tenantId=${encodeURIComponent(tenantId)}`,
            { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!response.ok) {
            let message = `HTTP ${response.status}`;
            try {
                const body = await response.json();
                message = body.message || message;
            } catch { /* ignore */ }
            throw new ApiError(message, { status: response.status });
        }
        const blob = await response.blob();
        const disposition = response.headers.get('Content-Disposition') ?? '';
        const nameMatch = disposition.match(/filename="([^"]+)"/);
        const filename = nameMatch?.[1] ?? `Mako -Invoice-${depositId.slice(0, 8)}.pdf`;
        const url = URL.createObjectURL(blob);
        if (view) {
          window.open(url, '_blank', 'noopener,noreferrer');
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
          return;
        }
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    },
    checkPending: () =>
        request<{ completed: number }>('/api/v1/payments/deposits/check-pending', {
            method: 'POST',
            body: JSON.stringify({}),
        }),
};

export const mediaApi = {
    findAll: (tenantId: string, workspaceId?: string) => {
        const qs = withWorkspace(new URLSearchParams({ tenantId }), workspaceId);
        return request<any[]>(`/api/v1/media?${qs}`);
    },
    upload: (file: File, tenantId: string, contentId?: string, workspaceId?: string) => {
        const form = new FormData();
        form.append('file', file);
        const token = getAuthToken();
        const q = withWorkspace(new URLSearchParams({ tenantId }), workspaceId);
        if (contentId) q.set('contentId', contentId);
        return fetch(`${API_BASE_URL}/api/v1/media/upload?${q}`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: form,
        }).then(async (res) => {
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || `HTTP ${res.status}`);
            return res.json();
        });
    },
    remove: (id: string, tenantId: string, workspaceId?: string) => {
        const qs = withWorkspace(new URLSearchParams({ tenantId }), workspaceId);
        return request<any>(`/api/v1/media/${id}?${qs}`, { method: 'DELETE' });
    },
};

export const templatesApi = {
    findAll: (tenantId: string, workspaceId?: string) => {
        const qs = withWorkspace(new URLSearchParams({ tenantId }), workspaceId);
        return request<any[]>(`/api/v1/templates?${qs}`);
    },
    findOne: (id: string, tenantId: string, workspaceId?: string) => {
        const qs = withWorkspace(new URLSearchParams({ tenantId }), workspaceId);
        return request<any>(`/api/v1/templates/${id}?${qs}`);
    },
    create: (data: Record<string, unknown>) =>
        request<any>('/api/v1/templates', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, tenantId: string, data: Record<string, unknown>, workspaceId?: string) => {
        const qs = withWorkspace(new URLSearchParams({ tenantId }), workspaceId);
        return request<any>(`/api/v1/templates/${id}?${qs}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    },
    remove: (id: string, tenantId: string, workspaceId?: string) => {
        const qs = withWorkspace(new URLSearchParams({ tenantId }), workspaceId);
        return request<any>(`/api/v1/templates/${id}?${qs}`, { method: 'DELETE' });
    },
};

// ==================== Content Items ====================
export type PaginatedContentItemsResponse = {
    items: Record<string, unknown>[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
};

export type ContentItemsListParams = {
    tenantId?: string;
    workspaceId?: string;
    page?: number;
    limit?: number;
    search?: string;
    platform?: string;
};

export const contentItemsApi = {
    create: (data: ContentItemsCreateDto) =>
        request<any>('/api/v1/content-items', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    findAll: (tenantId?: string, params?: Omit<ContentItemsListParams, 'tenantId'>) => {
        const qs = new URLSearchParams();
        if (tenantId) qs.set('tenantId', tenantId);
        if (params?.workspaceId) qs.set('workspaceId', params.workspaceId);
        if (params?.page != null) qs.set('page', String(params.page));
        if (params?.limit != null) qs.set('limit', String(params.limit));
        if (params?.search?.trim()) qs.set('search', params.search.trim());
        if (params?.platform?.trim()) qs.set('platform', params.platform.trim());
        const query = qs.toString();
        return request<any>(query ? `/api/v1/content-items?${query}` : '/api/v1/content-items');
    },

    findPage: (params: ContentItemsListParams = {}) =>
        contentItemsApi.findAll(params.tenantId, params) as Promise<PaginatedContentItemsResponse>,

    findOne: (id: string) => request<any>(`/api/v1/content-items/${id}`),

    getDetails: (id: string) => request<any>(`/api/v1/content-items/${id}/details`),

    update: (id: string, data: ContentItemsUpdateDto) =>
        request<any>(`/api/v1/content-items/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    attachMedia: (
        id: string,
        tenantId: string,
        items: Array<{ url: string; type?: string; assetId?: string }>,
    ) =>
        request<any>(`/api/v1/content-items/${id}/media`, {
            method: 'POST',
            body: JSON.stringify({ tenantId, items }),
        }),

    remove: (id: string) =>
        request<any>(`/api/v1/content-items/${id}`, { method: 'DELETE' }),

    bulkDelete: (ids: string[]) =>
        request<{ success: boolean; affected: number }>('/api/v1/content-items/bulk-delete', {
            method: 'POST',
            body: JSON.stringify({ ids }),
        }),
};

// ==================== Leads ====================
export const leadsApi = {
    create: (data: LeadsCreateDto) =>
        request<any>('/api/v1/leads', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    findAll: (tenantId?: string, workspaceId?: string) => {
        const qs = new URLSearchParams();
        if (tenantId) qs.set('tenantId', tenantId);
        withWorkspace(qs, workspaceId);
        const q = qs.toString();
        return request<any>(q ? `/api/v1/leads?${q}` : '/api/v1/leads');
    },

    findOne: (id: string) => request<any>(`/api/v1/leads/${id}`),

    update: (id: string, data: LeadsUpdateDto) =>
        request<any>(`/api/v1/leads/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    remove: (id: string) =>
        request<any>(`/api/v1/leads/${id}`, { method: 'DELETE' }),

    sendEmail: (data: { to: string; subject: string; body: string }) =>
        request<{ sent: boolean }>('/api/v1/leads/send-email', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
};

// ==================== Lead Sources ====================
export const leadSourcesApi = {
    create: (data: LeadSourcesCreateDto) =>
        request<any>('/api/v1/lead-source', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    findAll: () => request<any>('/api/v1/lead-source'),

    findOne: (id: string) => request<any>(`/api/v1/lead-source/${id}`),

    update: (id: string, data: LeadSourcesUpdateDto) =>
        request<any>(`/api/v1/lead-source/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    remove: (id: string) =>
        request<any>(`/api/v1/lead-source/${id}`, { method: 'DELETE' }),
};

// ==================== Payment Failures ====================
export const paymentFailuresApi = {
    create: (data: PaymentFailuresCreateDto) =>
        request<any>('/payment-failures', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    findAll: () => request<any>('/payment-failures'),

    findOne: (id: string) => request<any>(`/payment-failures/${id}`),

    update: (id: string, data: PaymentFailuresUpdateDto) =>
        request<any>(`/payment-failures/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    remove: (id: string) =>
        request<any>(`/payment-failures/${id}`, { method: 'DELETE' }),
};

// ==================== Deposits ====================
export const depositsApi = {
    create: (data: DepositsCreateDto) =>
        request<any>('/api/v1/deposits', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    findAll: () => request<any>('/api/v1/deposits'),

    findOne: (id: string) => request<any>(`/api/v1/deposits/${id}`),

    update: (id: string, data: DepositsUpdateDto) =>
        request<any>(`/api/v1/deposits/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    remove: (id: string) =>
        request<any>(`/api/v1/deposits/${id}`, { method: 'DELETE' }),
};

// ==================== Approval Requests ====================
export const approvalRequestsApi = {
    create: (data: {
        tenantId: string;
        actionKey: string;
        resourceType: string;
        resourceId: string;
        requestedBy: string;
        status?: string;
        payload?: Record<string, unknown>;
        requesterNotes?: string;
    }) =>
        request<any>('/api/v1/approval-requests', {
            method: 'POST',
            body: JSON.stringify({ status: 'pending', ...data }),
        }),

    findAll: (opts?: { tenantId?: string; status?: string; statuses?: string[] }) => {
        const params = new URLSearchParams();
        if (opts?.tenantId) params.set('tenantId', opts.tenantId);
        if (opts?.status) params.set('status', opts.status);
        if (opts?.statuses?.length) params.set('statuses', opts.statuses.join(','));
        const qs = params.toString();
        return request<any[]>(`/api/v1/approval-requests${qs ? `?${qs}` : ''}`);
    },

    findOne: (id: string) => request<any>(`/api/v1/approval-requests/${id}`),

    update: (id: string, data: ApprovalRequestsUpdateDto) =>
        request<any>(`/api/v1/approval-requests/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    remove: (id: string) =>
        request<any>(`/api/v1/approval-requests/${id}`, { method: 'DELETE' }),
};

// ==================== Auto Reply Rules ====================
export const autoReplyRulesApi = {
    create: (data: AutoReplyRulesCreateDto) =>
        request<any>('/api/v1/auto-reply-rules', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    findAll: (tenantId?: string, workspaceId?: string) => {
        const qs = new URLSearchParams();
        if (tenantId) qs.set('tenantId', tenantId);
        withWorkspace(qs, workspaceId);
        const q = qs.toString();
        return request<any>(q ? `/api/v1/auto-reply-rules?${q}` : '/api/v1/auto-reply-rules');
    },

    findOne: (id: string) => request<any>(`/api/v1/auto-reply-rules/${id}`),

    update: (id: string, data: AutoReplyRulesUpdateDto) =>
        request<any>(`/api/v1/auto-reply-rules/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    remove: (id: string) =>
        request<any>(`/api/v1/auto-reply-rules/${id}`, { method: 'DELETE' }),
};

// ==================== Platform capabilities ====================
export const platformsApi = {
    capabilities: () =>
        request<{
            platforms: Array<Record<string, unknown>>;
            whatsapp?: {
                connectionMode: 'platform' | 'oauth';
                platformConfigured: boolean;
                displayName?: string;
                displayPhone?: string;
            };
        }>('/api/v1/platforms/capabilities'),
};

// ==================== WhatsApp ====================
export const whatsappContactsApi = {
    create: (data: WhatsappContactsCreateDto) =>
        request<any>('/api/v1/whatsapp/contacts', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    findAll: (tenantId: string, workspaceId?: string) => {
        const qs = withWorkspace(new URLSearchParams({ tenantId }), workspaceId);
        return request<any>(`/api/v1/whatsapp/contacts?${qs}`);
    },

    findOne: (id: string, tenantId: string, workspaceId?: string) => {
        const qs = withWorkspace(new URLSearchParams({ tenantId }), workspaceId);
        return request<any>(`/api/v1/whatsapp/contacts/${id}?${qs}`);
    },

    update: (id: string, tenantId: string, data: WhatsappContactsUpdateDto, workspaceId?: string) => {
        const qs = withWorkspace(new URLSearchParams({ tenantId }), workspaceId);
        return request<any>(`/api/v1/whatsapp/contacts/${id}?${qs}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    },

    remove: (id: string, tenantId: string, workspaceId?: string) => {
        const qs = withWorkspace(new URLSearchParams({ tenantId }), workspaceId);
        return request<any>(`/api/v1/whatsapp/contacts/${id}?${qs}`, { method: 'DELETE' });
    },
};

export const whatsappApi = {
    listMessages: (tenantId: string, phone?: string, workspaceId?: string) => {
        const q = withWorkspace(new URLSearchParams({ tenantId }), workspaceId);
        if (phone) q.set('phone', phone);
        return request<any[]>(`/api/v1/whatsapp/messages?${q}`);
    },

    conversations: (tenantId: string, workspaceId?: string) => {
        const qs = withWorkspace(new URLSearchParams({ tenantId }), workspaceId);
        return request<Array<{ phone: string; lastMessage: string; lastAt: string; inboundCount: number }>>(
            `/api/v1/whatsapp/conversations?${qs}`,
        );
    },

    reply: (data: {
        tenantId: string;
        phone: string;
        message: string;
        workspaceId?: string;
        leadId?: string;
        contactId?: string;
        useTemplate?: boolean;
        templateName?: string;
        templateLanguage?: string;
    }) =>
        request<{ sent: boolean; message?: string; usedTemplate?: boolean }>(
            '/api/v1/whatsapp/messages/reply',
            {
                method: 'POST',
                body: JSON.stringify(data),
            },
        ),

    listTemplates: (tenantId: string, workspaceId?: string) => {
        const qs = withWorkspace(new URLSearchParams({ tenantId }), workspaceId);
        return request<{
            templates: Array<{ name: string; language: string; status: string; category?: string }>;
            defaultTemplate?: string;
        }>(`/api/v1/whatsapp/templates?${qs}`);
    },

    getFlowConfig: (tenantId: string, workspaceId?: string) => {
        const qs = withWorkspace(new URLSearchParams({ tenantId }), workspaceId);
        return request<{
            enabled: boolean;
            serviceName: string;
            welcomeMessage?: string;
            flowType: string;
            welcomeTriggers: string[];
            aiFallbackEnabled: boolean;
            menuItems: Array<{ id: string; title: string; description?: string; response: string; aiGenerate?: boolean }>;
        }>(`/api/v1/whatsapp/flows/config?${qs}`);
    },

    updateFlowConfig: (
        tenantId: string,
        data: Partial<{
            enabled: boolean;
            serviceName: string;
            welcomeMessage: string;
            aiFallbackEnabled: boolean;
            welcomeTriggers: string[];
            menuItems: Array<{ id?: string; title: string; description?: string; response?: string; aiGenerate?: boolean }>;
        }>,
        workspaceId?: string,
    ) => {
        const qs = withWorkspace(new URLSearchParams({ tenantId }), workspaceId);
        return request<any>(`/api/v1/whatsapp/flows/config?${qs}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    },
};

// ==================== Unified Inbox ====================
export type UnifiedConversation = {
    id: string;
    channel: 'post_comment' | 'dm';
    platform: string;
    title: string;
    preview: string;
    lastAt: string;
    unreadCount: number;
    pendingCount: number;
    participantName?: string | null;
    participantAvatarUrl?: string | null;
    contentId?: string;
    threadId?: string;
    phone?: string;
    postKey?: string;
};

export type UnifiedMessage = {
    id: string;
    channel: 'post_comment' | 'dm' | 'whatsapp';
    platform: string;
    direction: 'inbound' | 'outbound';
    body: string;
    attachments?: Array<{ url?: string; type?: string; name?: string }>;
    reactions?: Array<{ type: string; count?: number }>;
    status: string;
    authorName?: string;
    created_at: string;
};

export const inboxApi = {
    conversations: (tenantId: string, channel?: 'post_comment' | 'dm' | 'all', workspaceId?: string) => {
        const params = withWorkspace(new URLSearchParams({ tenantId }), workspaceId);
        if (channel) params.set('channel', channel);
        return request<UnifiedConversation[]>(`/api/v1/inbox/conversations?${params.toString()}`);
    },

    messages: (tenantId: string, conversationId: string, workspaceId?: string) => {
        const params = withWorkspace(
            new URLSearchParams({ tenantId, conversationId }),
            workspaceId,
        );
        return request<UnifiedMessage[]>(`/api/v1/inbox/messages?${params.toString()}`);
    },

    sync: (tenantId: string, workspaceId?: string) =>
        request<{ synced: number }>('/api/v1/inbox/sync', {
            method: 'POST',
            body: JSON.stringify({ tenantId, workspaceId }),
        }),

    reply: (
        tenantId: string,
        conversationId: string,
        message: string,
        options?: {
            workspaceId?: string;
            useTemplate?: boolean;
            templateName?: string;
            templateLanguage?: string;
        },
    ) =>
        request<{ sent: boolean; message?: string; usedTemplate?: boolean }>(
            '/api/v1/inbox/messages/reply',
            {
                method: 'POST',
                body: JSON.stringify({ tenantId, conversationId, message, ...options }),
            },
        ),
};

// ==================== Content Publications / Engagement ====================
export const contentPublicationsApi = {
    topPerforming: (tenantId: string, limit = 5, workspaceId?: string) => {
        const qs = withWorkspace(new URLSearchParams({ tenantId, limit: String(limit) }), workspaceId);
        return request<TopPerformingPost[]>(`/api/v1/content-publications/top-performing?${qs}`);
    },

    syncEngagement: (tenantId: string, workspaceId?: string) =>
        request<{ updated: number }>('/api/v1/content-publications/sync-engagement', {
            method: 'POST',
            body: JSON.stringify({ tenantId, workspaceId }),
        }),
};

// ==================== Comment Replies ====================
export type CommentInboxNode = {
    id: string;
    externalCommentId: string;
    parentCommentId: string | null;
    commenterName: string;
    commenterAvatarUrl: string | null;
    commentText: string;
    replyText: string | null;
    replyType: string | null;
    status: string;
    likeCount: number;
    isFromBrand: boolean;
    attachments?: Array<{ url?: string; type?: string; name?: string }>;
    reactions?: Array<{ type: string; count?: number }>;
    created_at: string;
    children: CommentInboxNode[];
};

export type PostInboxGroup = {
    key: string;
    contentId: string;
    platform: string;
    externalPostId: string;
    postTitle: string;
    postContent: string;
    postMedia: Array<{ url: string; type?: string; name?: string }>;
    publishedAt: string | null;
    brandPageName: string | null;
    likeCount: number;
    commentCount: number;
    shareCount: number;
    viewCount: number;
    engagementScore: number;
    pendingCount: number;
    totalComments: number;
    comments: CommentInboxNode[];
    commentSyncSupported?: boolean;
    commentSyncNote?: string;
};

export type TopPerformingPost = {
    id: string;
    contentId: string;
    platform: string;
    publishedTitle: string | null;
    publishedContent: string;
    likeCount: number;
    commentCount: number;
    shareCount: number;
    viewCount: number;
    engagementScore: number;
    publishedAt: string | null;
};

export const commentRepliesApi = {
    inbox: (tenantId: string, contentId?: string, workspaceId?: string) => {
        const params = withWorkspace(new URLSearchParams({ tenantId }), workspaceId);
        if (contentId) params.set('contentId', contentId);
        return request<{ posts: PostInboxGroup[] }>(
            `/api/v1/comment-replies/inbox?${params.toString()}`,
        );
    },

    fetch: (tenantId: string, workspaceId?: string) =>
        request<{ fetched: number; autoReplied?: number }>('/api/v1/comment-replies/fetch', {
            method: 'POST',
            body: JSON.stringify({ tenantId, workspaceId }),
        }),

    suggest: (id: string) =>
        request<{ content: string }>(`/api/v1/comment-replies/${id}/suggest`, {
            method: 'POST',
            body: JSON.stringify({}),
        }),

    send: (id: string, message: string) =>
        request<{ sent: boolean }>(`/api/v1/comment-replies/${id}/send`, {
            method: 'POST',
            body: JSON.stringify({ message }),
        }),

    create: (data: CommentRepliesCreateDto) =>
        request<any>('/api/v1/comment-replies', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    findAll: (tenantId?: string) =>
        request<any>(
            tenantId
                ? `/api/v1/comment-replies?tenantId=${encodeURIComponent(tenantId)}`
                : '/api/v1/comment-replies',
        ),

    findOne: (id: string) => request<any>(`/api/v1/comment-replies/${id}`),

    update: (id: string, data: CommentRepliesUpdateDto) =>
        request<any>(`/api/v1/comment-replies/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    remove: (id: string) =>
        request<any>(`/api/v1/comment-replies/${id}`, { method: 'DELETE' }),
};

// ==================== Audit Logs ====================
export const auditLogsApi = {
    create: (data: {
        tenantId: string;
        action: string;
        resourceType?: string;
        resourceId?: string;
        metadata?: Record<string, unknown>;
        beforeState?: Record<string, unknown>;
        afterState?: Record<string, unknown>;
    }) =>
        request<any>('/api/v1/audit-logs', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    findAll: (opts?: {
        tenantId?: string;
        search?: string;
        module?: string;
        page?: number;
        take?: number;
    }) => {
        const params = new URLSearchParams();
        if (opts?.tenantId) params.set('tenantId', opts.tenantId);
        if (opts?.search) params.set('search', opts.search);
        if (opts?.module) params.set('module', opts.module);
        if (opts?.page != null) params.set('page', String(opts.page));
        if (opts?.take != null) params.set('take', String(opts.take));
        const qs = params.toString();
        return request<{ items: unknown[]; total: number } | unknown[]>(
            `/api/v1/audit-logs${qs ? `?${qs}` : ''}`,
        );
    },

    findOne: (id: string) => request<any>(`/api/v1/audit-logs/${id}`),

    update: (id: string, data: AuditLogsUpdateDto) =>
        request<any>(`/api/v1/audit-logs/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    remove: (id: string) =>
        request<any>(`/api/v1/audit-logs/${id}`, { method: 'DELETE' }),
};

// ==================== AI ====================
export type FormSuggestionForm = 'brand-brain' | 'content' | 'campaign' | 'whatsapp-menu';

export const aiApi = {
    getFormSuggestions: (data: {
        tenantId: string;
        workspaceId?: string;
        form: FormSuggestionForm;
        fields?: string[];
    }) =>
        request<{ suggestions: Record<string, string[]> }>('/api/v1/ai/form-suggestions', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    health: () => request<{ status: string; model?: string }>('/api/v1/ai/health'),
};

// ==================== Global Search ====================
export type SearchResultType = 'content' | 'lead' | 'template' | 'knowledge' | 'audit';

export interface SearchResult {
    type: SearchResultType;
    id: string;
    title: string;
    subtitle?: string;
    url: string;
}

export const searchApi = {
    query: (params: { tenantId: string; q: string }) => {
        const qs = new URLSearchParams({
            tenantId: params.tenantId,
            q: params.q.trim(),
        });
        return request<SearchResult[]>(`/api/v1/search?${qs.toString()}`);
    },

    ask: (data: { tenantId: string; q: string }) =>
        request<{ answer: string; links: Array<{ title: string; url: string }> }>(
            '/api/v1/search/ask',
            { method: 'POST', body: JSON.stringify(data) },
        ),
};

// ==================== Ai Usage ====================
export const aiUsageApi = {
    create: (data: AiUsageCreateDto) =>
        request<any>('/api/v1/ai-usage', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    findAll: () => request<any>('/api/v1/ai-usage'),

    findOne: (id: string) => request<any>(`/api/v1/ai-usage/${id}`),

    update: (id: string, data: AiUsageUpdateDto) =>
        request<any>(`/api/v1/ai-usage/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    remove: (id: string) =>
        request<any>(`/api/v1/ai-usage/${id}`, { method: 'DELETE' }),
};

// ==================== Notifications & Reports ====================
export type AppNotification = {
    id: string;
    tenantId: string;
    userId: string;
    type: string;
    title: string;
    body: string;
    link?: string | null;
    read: boolean;
    emailSent: boolean;
    metadata?: Record<string, unknown>;
    created_at: string;
};

export type NotificationPreferences = {
    userId: string;
    tenantId: string;
    emailPublishSuccess: boolean;
    emailBilling: boolean;
    emailWeeklyDigest: boolean;
    emailHotLeads: boolean;
    inAppEnabled: boolean;
};

export type ReportCatalogItem = {
    id: string;
    name: string;
    description: string;
    category: string;
};

export type ChatbotConfig = {
    id: string;
    tenantId: string;
    name: string;
    welcomeMessage?: string;
    systemPromptExtra?: string;
    model: string;
    temperature: number;
    maxContextMessages: number;
    ragEnabled: boolean;
    ragTopK: number;
    ragMinScore: number;
    widgetEnabled: boolean;
    widgetTheme?: Record<string, unknown>;
    allowedOrigins?: string[];
    isActive: boolean;
    useMistralLibrary?: boolean;
    mistralLibraryId?: string;
    mistralAgentId?: string;
    widgetTtsEnabled?: boolean;
    mistralVoiceId?: string;
};

export type ChatCitation = {
    documentId: string;
    chunkId?: string;
    title: string;
    excerpt: string;
};

export type ChatMessage = {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    citations?: ChatCitation[];
    created_at: string;
};

export type TtsPresetVoice = {
    id: string;
    name: string;
    gender?: string | null;
    description?: string | null;
    languages?: string[];
    isCustom: boolean;
};

export type TtsVoiceList = {
    presets: TtsPresetVoice[];
    custom: Array<{ id: string; mistralVoiceId: string; name: string; created_at: string }>;
    selectedVoiceId: string | null;
};

export type KnowledgeDocument = {
    id: string;
    title: string;
    status: 'pending' | 'processing' | 'ready' | 'failed';
    mimeType?: string;
    chunkCount: number;
    errorMessage?: string;
    created_at: string;
};

export type ChatbotApiKeySummary = {
    id: string;
    keyPrefix: string;
    label?: string;
    lastUsedAt?: string;
    revokedAt?: string;
    created_at?: string;
};

export const chatbotApi = {
    getConfig: (tenantId: string, workspaceId?: string) => {
        const qs = withWorkspace(new URLSearchParams({ tenantId }), workspaceId);
        return request<{ config: ChatbotConfig; keys: ChatbotApiKeySummary[] }>(
            `/api/v1/chatbot/config?${qs}`,
        );
    },

    updateConfig: (data: Partial<ChatbotConfig> & { tenantId: string; workspaceId?: string }) => {
        const body: Record<string, unknown> = { tenantId: data.tenantId };
        if (data.workspaceId) body.workspaceId = data.workspaceId;
        const optionalKeys = [
            'name',
            'welcomeMessage',
            'systemPromptExtra',
            'brandProfileId',
            'model',
            'temperature',
            'maxContextMessages',
            'ragEnabled',
            'ragTopK',
            'ragMinScore',
            'widgetEnabled',
            'widgetTheme',
            'allowedOrigins',
            'isActive',
            'useMistralLibrary',
            'widgetTtsEnabled',
            'mistralVoiceId',
        ] as const;
        for (const key of optionalKeys) {
            const value = data[key];
            if (value !== undefined && value !== null) {
                body[key] = value;
            }
        }
        if ('mistralVoiceId' in data && data.mistralVoiceId === '') {
            body.mistralVoiceId = '';
        }
        return request<ChatbotConfig>('/api/v1/chatbot/config', {
            method: 'PATCH',
            body: JSON.stringify(body),
        });
    },

    uploadAvatar: (file: File, tenantId: string, workspaceId?: string) => {
        const form = new FormData();
        form.append('file', file);
        const token = getAuthToken();
        if (!token) throw new ApiError('Not authenticated', { status: 401, isAuthError: true });
        const qs = withWorkspace(new URLSearchParams({ tenantId }), workspaceId);
        return fetch(
            `${API_BASE_URL}/api/v1/chatbot/config/avatar?${qs}`,
            { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form },
        ).then(async (res) => {
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new ApiError(body.message || `HTTP ${res.status}`, { status: res.status });
            }
            return res.json() as Promise<ChatbotConfig>;
        });
    },

    uploadAvatarModel: (file: File, tenantId: string, workspaceId?: string) => {
        const form = new FormData();
        form.append('file', file);
        const token = getAuthToken();
        if (!token) throw new ApiError('Not authenticated', { status: 401, isAuthError: true });
        const qs = withWorkspace(new URLSearchParams({ tenantId }), workspaceId);
        return fetch(
            `${API_BASE_URL}/api/v1/chatbot/config/avatar-model?${qs}`,
            { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form },
        ).then(async (res) => {
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new ApiError(body.message || `HTTP ${res.status}`, { status: res.status });
            }
            return res.json() as Promise<ChatbotConfig>;
        });
    },

    createApiKey: (tenantId: string, label?: string) =>
        request<{ id: string; keyPrefix: string; secret: string; label?: string }>(
            '/api/v1/chatbot/config/keys',
            { method: 'POST', body: JSON.stringify({ tenantId, label }) },
        ),

    revokeApiKey: (tenantId: string, keyId: string) =>
        request<void>(`/api/v1/chatbot/config/keys/${keyId}?tenantId=${encodeURIComponent(tenantId)}`, {
            method: 'DELETE',
        }),

    listSessions: (tenantId: string, channel?: string, workspaceId?: string) => {
        const params = withWorkspace(new URLSearchParams({ tenantId }), workspaceId);
        if (channel) params.set('channel', channel);
        return request<Array<{ id: string; title?: string; channel: string; lastMessageAt?: string; created_at: string }>>(
            `/api/v1/chatbot/sessions?${params}`,
        );
    },

    createSession: (tenantId: string, workspaceId?: string) =>
        request<{ id: string }>('/api/v1/chatbot/sessions', {
            method: 'POST',
            body: JSON.stringify({ tenantId, workspaceId }),
        }),

    getMessages: (tenantId: string, sessionId: string, workspaceId?: string) => {
        const qs = withWorkspace(new URLSearchParams({ tenantId }), workspaceId);
        return request<ChatMessage[]>(`/api/v1/chatbot/sessions/${sessionId}/messages?${qs}`);
    },

    sendMessage: (tenantId: string, sessionId: string, content: string, workspaceId?: string) => {
        const qs = withWorkspace(new URLSearchParams({ tenantId }), workspaceId);
        return request<{ messageId: string; content: string; citations: ChatCitation[] }>(
            `/api/v1/chatbot/sessions/${sessionId}/messages?${qs}`,
            { method: 'POST', body: JSON.stringify({ content }) },
        );
    },

    listTtsVoices: (tenantId: string) =>
        request<TtsVoiceList>(
            `/api/v1/chatbot/tts/voices?tenantId=${encodeURIComponent(tenantId)}`,
        ),

    cloneTtsVoice: (tenantId: string, name: string, file: File) => {
        const form = new FormData();
        form.append('file', file);
        form.append('name', name);
        const token = getAuthToken();
        if (!token) throw new ApiError('Not authenticated', { status: 401, isAuthError: true });
        return fetch(
            `${API_BASE_URL}/api/v1/chatbot/tts/voices?tenantId=${encodeURIComponent(tenantId)}`,
            { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form },
        ).then(async (res) => {
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new ApiError(body.message || `HTTP ${res.status}`, { status: res.status });
            }
            return res.json() as Promise<{
                voice: { id: string; mistralVoiceId: string; name: string; created_at: string };
                selectedVoiceId: string;
            }>;
        });
    },

    deleteTtsVoice: (tenantId: string, voiceRowId: string) =>
        request<void>(
            `/api/v1/chatbot/tts/voices/${voiceRowId}?tenantId=${encodeURIComponent(tenantId)}`,
            { method: 'DELETE' },
        ),

    previewTtsVoice: async (
        tenantId: string,
        voiceId: string,
        text?: string,
    ): Promise<Blob> => {
        const token = getAuthToken();
        if (!token) throw new ApiError('Not authenticated', { status: 401, isAuthError: true });
        const res = await fetch(
            `${API_BASE_URL}/api/v1/chatbot/tts/preview?tenantId=${encodeURIComponent(tenantId)}`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ voiceId, text }),
            },
        );
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new ApiError(body.message || `HTTP ${res.status}`, { status: res.status });
        }
        return res.blob();
    },

    fetchSpeech: async (tenantId: string, sessionId: string, messageId: string): Promise<Blob> => {
        const token = getAuthToken();
        if (!token) throw new ApiError('Not authenticated', { status: 401, isAuthError: true });
        const res = await fetch(
            `${API_BASE_URL}/api/v1/chatbot/sessions/${sessionId}/messages/${messageId}/speech?tenantId=${encodeURIComponent(tenantId)}`,
            { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new ApiError(body.message || `HTTP ${res.status}`, { status: res.status });
        }
        return res.blob();
    },

    deleteSession: (tenantId: string, sessionId: string) =>
        request<void>(
            `/api/v1/chatbot/sessions/${sessionId}?tenantId=${encodeURIComponent(tenantId)}`,
            { method: 'DELETE' },
        ),
};

export const knowledgeApi = {
    list: (tenantId: string, workspaceId?: string) => {
        const qs = withWorkspace(new URLSearchParams({ tenantId }), workspaceId);
        return request<KnowledgeDocument[]>(`/api/v1/knowledge/documents?${qs}`);
    },

    upload: (file: File, tenantId: string, workspaceId?: string) => {
        const form = new FormData();
        form.append('file', file);
        const token = getAuthToken();
        if (!token) throw new ApiError('Not authenticated', { status: 401, isAuthError: true });
        const qs = withWorkspace(new URLSearchParams({ tenantId }), workspaceId);
        return fetch(
            `${API_BASE_URL}/api/v1/knowledge/documents?${qs}`,
            { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form },
        ).then(async (res) => {
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new ApiError(body.message || `HTTP ${res.status}`, { status: res.status });
            }
            return res.json() as Promise<KnowledgeDocument>;
        });
    },

    rename: (tenantId: string, id: string, title: string, workspaceId?: string) =>
        request<KnowledgeDocument>(`/api/v1/knowledge/documents/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ tenantId, title, workspaceId }),
        }),

    delete: (tenantId: string, id: string, workspaceId?: string) => {
        const qs = withWorkspace(new URLSearchParams({ tenantId }), workspaceId);
        return request<void>(`/api/v1/knowledge/documents/${id}?${qs}`, {
            method: 'DELETE',
        });
    },

    reindex: (tenantId: string, id: string, workspaceId?: string) => {
        const qs = withWorkspace(new URLSearchParams({ tenantId }), workspaceId);
        return request<KnowledgeDocument>(
            `/api/v1/knowledge/documents/${id}/reindex?${qs}`,
            { method: 'POST' },
        );
    },

    syncMistral: (tenantId: string, workspaceId?: string) => {
        const qs = withWorkspace(new URLSearchParams({ tenantId }), workspaceId);
        return request<{ success: true }>(
            `/api/v1/knowledge/documents/sync-mistral?${qs}`,
            { method: 'POST' },
        );
    },
};

export const notificationsApi = {
    list: (tenantId: string, unreadOnly?: boolean) => {
        const params = new URLSearchParams({ tenantId });
        if (unreadOnly) params.set('unreadOnly', 'true');
        return request<AppNotification[]>(`/api/v1/notifications?${params}`);
    },

    unreadCount: (tenantId: string) =>
        request<{ count: number }>(
            `/api/v1/notifications/unread-count?tenantId=${encodeURIComponent(tenantId)}`,
        ),

    markRead: (id: string) =>
        request<void>(`/api/v1/notifications/${id}/read`, { method: 'PATCH' }),

    markAllRead: (tenantId: string) =>
        request<void>('/api/v1/notifications/mark-all-read', {
            method: 'POST',
            body: JSON.stringify({ tenantId }),
        }),

    getPreferences: (tenantId: string) =>
        request<NotificationPreferences>(
            `/api/v1/notifications/preferences?tenantId=${encodeURIComponent(tenantId)}`,
        ),

    updatePreferences: (data: Partial<NotificationPreferences> & { tenantId: string }) =>
        request<NotificationPreferences>('/api/v1/notifications/preferences', {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    reportCatalog: () =>
        request<ReportCatalogItem[]>('/api/v1/notifications/reports/catalog'),

    generateReport: (tenantId: string, reportId: string) =>
        request<Record<string, unknown>>(
            `/api/v1/notifications/reports/${encodeURIComponent(reportId)}?tenantId=${encodeURIComponent(tenantId)}`,
        ),

    downloadReport: async (
        tenantId: string,
        reportId: string,
        format: 'pdf' | 'csv' | 'xlsx',
    ) => {
        const token = getAuthToken();
        if (!token) throw new ApiError('Not authenticated', { status: 401, isAuthError: true });
        const params = new URLSearchParams({ tenantId, format });
        const response = await fetch(
            `${API_BASE_URL}/api/v1/notifications/reports/${encodeURIComponent(reportId)}/export?${params}`,
            { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!response.ok) {
            let message = `HTTP ${response.status}`;
            try {
                const body = await response.json();
                message = body.message || message;
            } catch { /* ignore */ }
            throw new ApiError(message, { status: response.status });
        }
        const blob = await response.blob();
        const disposition = response.headers.get('Content-Disposition') ?? '';
        const nameMatch = disposition.match(/filename="([^"]+)"/);
        const filename =
            nameMatch?.[1] ?? `autopilot-${reportId}-${new Date().toISOString().slice(0, 10)}.${format}`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    },
};
export const adsApi = {
    createCampaign: (tenantId: string, data: any) =>
        request('/api/v1/ads/campaigns', {
            method: 'POST',
            body: JSON.stringify({ ...data, tenantId, launch: true }),
        }),
    getCampaigns: (tenantId: string) =>
        request<any[]>(`/api/v1/ads/campaigns?tenantId=${tenantId}`),
    publishCampaign: (tenantId: string, id: string) =>
        request(`/api/v1/ads/campaigns/${id}/publish`, {
            method: 'POST',
            body: JSON.stringify({ tenantId }),
        }),
    pauseCampaign: (tenantId: string, id: string) =>
        request(`/api/v1/ads/campaigns/${id}/pause`, {
            method: 'POST',
            body: JSON.stringify({ tenantId }),
        }),
    getMetrics: (tenantId: string, id: string) =>
        request<{ spend: number; impressions: number; clicks: number }>(
            `/api/v1/ads/campaigns/${id}/metrics?tenantId=${tenantId}`,
        ),
    getDashboardStats: (tenantId: string) =>
        request<{ activeCampaigns: number; totalSpend: number; totalImpressions: number }>(
            `/api/v1/ads/dashboard-stats?tenantId=${tenantId}`,
        ),
    getEmbedScript: (tenantId: string, id: string) =>
        request<{ scriptUrl: string; snippet: string }>(
            `/api/v1/ads/campaigns/${id}/embed-script?tenantId=${tenantId}`,
        ),
    getBalance: (tenantId: string) =>
        request<{ balance: number }>(`/api/v1/ads/balance?tenantId=${tenantId}`),
    generateCampaignAssist: (tenantId: string, prompt: string, platform: string) =>
        request<{ name: string; targetAudience: string; prompt: string; location: string; ageRange: string }>(
            '/api/v1/ads/ai-assist',
            {
                method: 'POST',
                body: JSON.stringify({ tenantId, prompt, platform }),
            },
        ),
};
