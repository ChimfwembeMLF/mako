// src/lib/api.ts
import type { UserRole } from './roles';
import { ApiError, reportApiFailure, reportApiSuccess } from './api-errors';

export { ApiError, isNetworkError, isAuthError } from './api-errors';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

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

export interface BrandProfilesCreateDto { }
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
    return `${API_BASE_URL}/api/v1/auth/${provider}`;
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
            const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
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
        response = await fetch(`${API_BASE_URL}${endpoint}`, {
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
        return undefined as T;
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

    findByTenant: (tenantId: string) =>
        request<SocialAccount[]>(`/api/v1/social-accounts/tenant/${tenantId}`),

    startOAuth: (platform: string, tenantId: string, returnUrl: string) =>
        request<{ redirectUrl: string }>(
            `/api/v1/social-accounts/oauth/${platform}/authorize?tenantId=${encodeURIComponent(tenantId)}&returnUrl=${encodeURIComponent(returnUrl)}`,
        ),

    getFacebookSetup: (token: string) =>
        request<{ pages: Array<{ id: string; name: string; category?: string }>; profileName?: string }>(
            `/api/v1/social-accounts/facebook/setup?token=${encodeURIComponent(token)}`,
        ),

    finalizeFacebook: (data: { setupToken: string; pageId: string }) =>
        request<SocialAccount>('/api/v1/social-accounts/facebook/finalize', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getWhatsappSetup: (token: string) =>
        request<{ phones: Array<{ id: string; displayPhoneNumber?: string; verifiedName?: string; wabaId: string; wabaName?: string }> }>(
            `/api/v1/social-accounts/whatsapp/setup?token=${encodeURIComponent(token)}`,
        ),

    setupWhatsappFromMeta: (tenantId: string) =>
        request<
            | {
                  ready: true;
                  setupToken: string;
                  phones: Array<{ id: string; displayPhoneNumber?: string; verifiedName?: string; wabaId: string; wabaName?: string }>;
                  source: 'facebook';
              }
            | { ready: false; needOAuth: true; reason: 'no_facebook' | 'missing_scopes' | 'no_phones' }
        >(`/api/v1/social-accounts/whatsapp/setup-from-meta?tenantId=${encodeURIComponent(tenantId)}`, {
            method: 'POST',
        }),

    enablePlatformWhatsapp: (tenantId: string) =>
        request<SocialAccount>(
            `/api/v1/social-accounts/whatsapp/enable-platform?tenantId=${encodeURIComponent(tenantId)}`,
            { method: 'POST' },
        ),

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

    getMine: (tenantId: string) =>
        request<any | null>(`/api/v1/brand-profiles/mine?tenantId=${tenantId}`),

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

    parseDocument: (file: File, tenantId: string) => {
        const form = new FormData();
        form.append('file', file);
        form.append('tenantId', tenantId);
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
    ) =>
        request<{ published: boolean; results: Record<string, { published: boolean; message: string }> }>(
            `/api/v1/content-ai/${contentId}/publish`,
            { method: 'POST', body: JSON.stringify({ platforms, platformPayloads }) },
        ),

    autoPublish: () =>
        request<{ attempted: number; published: number; failed: number; errors: string[] }>(
            '/api/v1/content-ai/auto-publish',
            { method: 'POST', body: JSON.stringify({}) },
        ),

    dailyWorkflow: (tenantId?: string) =>
        request<{ generated: number; skipped?: number; errors: string[] }>(
            '/api/v1/content-ai/daily-workflow',
            { method: 'POST', body: JSON.stringify({ tenantId }) },
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

    list: (tenantId: string) =>
        request<Record<string, unknown>[]>(`/api/v1/content-campaigns?tenantId=${tenantId}`),

    getOne: (id: string, tenantId: string) =>
        request<{ campaign: Record<string, unknown>; posts: Record<string, unknown>[] }>(
            `/api/v1/content-campaigns/${id}?tenantId=${tenantId}`,
        ),

    remove: (id: string, tenantId: string) =>
        request<{ deleted: boolean }>(`/api/v1/content-campaigns/${id}?tenantId=${tenantId}`, {
            method: 'DELETE',
        }),
};

export const subscriptionsApi = {
    getForTenant: (tenantId: string) =>
        request<{
            plan: string;
            status: string;
            dailyWorkflowEnabled: boolean;
            aiCallsLimit: number | null;
            aiCallsUsed: number;
            aiCallsRemaining: number | null;
            seatLimit: number | null;
            billingPeriodStart: string;
            billingPeriodEnd: string;
        }>(`/api/v1/subscriptions/tenant/${tenantId}`),
};

export const paymentsApi = {
    initiateDeposit: (data: { tenantId: string; plan: string; phone?: string; correspondent?: string }) =>
        request<{ paymentId: string; status: string; message: string; plan?: string; amount?: string }>(
            '/api/v1/payments/deposits/initiate',
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
        const filename = nameMatch?.[1] ?? `AutoPilot-Invoice-${depositId.slice(0, 8)}.pdf`;
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
    findAll: (tenantId: string) => request<any[]>(`/api/v1/media?tenantId=${tenantId}`),
    upload: (file: File, tenantId: string, contentId?: string) => {
        const form = new FormData();
        form.append('file', file);
        const token = getAuthToken();
        const q = new URLSearchParams({ tenantId });
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
    remove: (id: string, tenantId: string) =>
        request<any>(`/api/v1/media/${id}?tenantId=${tenantId}`, { method: 'DELETE' }),
};

export const templatesApi = {
    findAll: (tenantId: string) => request<any[]>(`/api/v1/templates?tenantId=${tenantId}`),
    findOne: (id: string, tenantId: string) =>
        request<any>(`/api/v1/templates/${id}?tenantId=${tenantId}`),
    create: (data: Record<string, unknown>) =>
        request<any>('/api/v1/templates', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, tenantId: string, data: Record<string, unknown>) =>
        request<any>(`/api/v1/templates/${id}?tenantId=${tenantId}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),
    remove: (id: string, tenantId: string) =>
        request<any>(`/api/v1/templates/${id}?tenantId=${tenantId}`, { method: 'DELETE' }),
};

// ==================== Content Items ====================
export const contentItemsApi = {
    create: (data: ContentItemsCreateDto) =>
        request<any>('/api/v1/content-items', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    findAll: (tenantId?: string) =>
        request<any>(tenantId ? `/api/v1/content-items?tenantId=${tenantId}` : '/api/v1/content-items'),

    findOne: (id: string) => request<any>(`/api/v1/content-items/${id}`),

    getDetails: (id: string) => request<any>(`/api/v1/content-items/${id}/details`),

    update: (id: string, data: ContentItemsUpdateDto) =>
        request<any>(`/api/v1/content-items/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    attachMedia: (id: string, tenantId: string, items: Array<{ url: string; type?: string }>) =>
        request<any>(`/api/v1/content-items/${id}/media`, {
            method: 'POST',
            body: JSON.stringify({ tenantId, items }),
        }),

    remove: (id: string) =>
        request<any>(`/api/v1/content-items/${id}`, { method: 'DELETE' }),
};

// ==================== Leads ====================
export const leadsApi = {
    create: (data: LeadsCreateDto) =>
        request<any>('/api/v1/leads', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    findAll: () => request<any>('/api/v1/leads'),

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

    findAll: () => request<any>('/api/v1/auto-reply-rules'),

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

    findAll: (tenantId: string) =>
        request<any>(`/api/v1/whatsapp/contacts?tenantId=${tenantId}`),

    findOne: (id: string, tenantId: string) =>
        request<any>(`/api/v1/whatsapp/contacts/${id}?tenantId=${tenantId}`),

    update: (id: string, tenantId: string, data: WhatsappContactsUpdateDto) =>
        request<any>(`/api/v1/whatsapp/contacts/${id}?tenantId=${tenantId}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    remove: (id: string, tenantId: string) =>
        request<any>(`/api/v1/whatsapp/contacts/${id}?tenantId=${tenantId}`, { method: 'DELETE' }),
};

export const whatsappApi = {
    listMessages: (tenantId: string, phone?: string) => {
        const q = new URLSearchParams({ tenantId });
        if (phone) q.set('phone', phone);
        return request<any[]>(`/api/v1/whatsapp/messages?${q}`);
    },

    conversations: (tenantId: string) =>
        request<Array<{ phone: string; lastMessage: string; lastAt: string; inboundCount: number }>>(
            `/api/v1/whatsapp/conversations?tenantId=${tenantId}`,
        ),

    reply: (data: { tenantId: string; phone: string; message: string }) =>
        request<{ sent: boolean; message?: string }>('/api/v1/whatsapp/messages/reply', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    listTemplates: (tenantId: string) =>
        request<{
            templates: Array<{ name: string; language: string; status: string; category?: string }>;
            defaultTemplate?: string;
        }>(`/api/v1/whatsapp/templates?tenantId=${tenantId}`),
};

// ==================== Comment Replies ====================
export const commentRepliesApi = {
    fetch: (tenantId: string) =>
        request<{ fetched: number }>('/api/v1/comment-replies/fetch', {
            method: 'POST',
            body: JSON.stringify({ tenantId }),
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

    findAll: () => request<any>('/api/v1/comment-replies'),

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
export type FormSuggestionForm = 'brand-brain' | 'content' | 'campaign';

export const aiApi = {
    getFormSuggestions: (data: {
        tenantId: string;
        form: FormSuggestionForm;
        fields?: string[];
    }) =>
        request<{ suggestions: Record<string, string[]> }>('/api/v1/ai/form-suggestions', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    health: () => request<{ status: string; model?: string }>('/api/v1/ai/health'),
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