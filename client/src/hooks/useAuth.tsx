import {
  authApi,
  getAuthToken,
  setAuthToken,
  setRefreshToken,
  getRefreshToken,
  LoginPayload,
  AuthProfile,
  AuthUser,
  TenantSummary,
  isAuthError,
  isNetworkError,
} from "@/lib/api";
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { UserRole, isSuperAdminRole } from "@/lib/roles";

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  tenantId?: string;
  roles?: string[];
  permissions?: string[];
}

export interface Session {
  accessToken: string;
  user: User;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; firstName?: string; lastName?: string }) => Promise<void>;
  completeOAuthLogin: (token: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  login: async () => { },
  register: async () => { },
  completeOAuthLogin: async () => { },
  requestPasswordReset: async () => { },
  signOut: async () => { },
});

const USER_CACHE_KEY = 'brandpilot_cached_user';

function cacheUser(u: User) {
  try {
    sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(u));
  } catch {
    /* ignore quota errors */
  }
}

function readCachedUser(): User | null {
  try {
    const raw = sessionStorage.getItem(USER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function clearUserCache() {
  sessionStorage.removeItem(USER_CACHE_KEY);
}

function persistActiveTenant(tenant?: TenantSummary) {
  if (tenant?.id) {
    localStorage.setItem('brandpilot_active_tenant', tenant.id);
  }
}

function applyProfile(userData: AuthProfile | AuthUser, tenant?: TenantSummary) {
  persistActiveTenant(tenant ?? ('tenant' in userData ? userData.tenant : undefined));
  return normalizeUser(userData);
}
function normalizeUser(data: AuthUser | Record<string, unknown>): User {
  const role = data.role as string | undefined;
  return {
    id: String(data.id),
    email: String(data.email ?? ""),
    firstName: data.firstName as string | undefined,
    lastName: data.lastName as string | undefined,
    role: role && Object.values(UserRole).includes(role as UserRole)
      ? (role as UserRole)
      : undefined,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const setAuthData = useCallback((token: string, userData: User, refreshToken?: string) => {
    setAuthToken(token);
    if (refreshToken) setRefreshToken(refreshToken);
    cacheUser(userData);
    setUser(userData);
    setSession({ accessToken: token, user: userData });
  }, []);

  const clearAuthData = useCallback(() => {
    setAuthToken(null);
    setRefreshToken(null);
    clearUserCache();
    localStorage.removeItem('brandpilot_active_tenant');
    setUser(null);
    setSession(null);
  }, []);

  const applyLoginPayload = useCallback((response: LoginPayload) => {
    const { token, user: userData, refreshToken, tenant } = response;
    if (!token || !userData) throw new Error("Invalid auth response");
    setAuthData(token, applyProfile(userData, tenant), refreshToken);
  }, [setAuthData]);

  const loadUserFromToken = useCallback(async () => {
    const callbackToken = new URLSearchParams(window.location.search).get("token");
    if (window.location.pathname === "/auth/callback" && callbackToken) {
      setLoading(false);
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const profile = await authApi.getMe() as AuthProfile;
      setAuthData(token, applyProfile(profile), getRefreshToken() ?? undefined);
    } catch (error: unknown) {
      if (isAuthError(error)) {
        const refreshToken = getRefreshToken();
        if (refreshToken) {
          try {
            const refreshed = await authApi.refreshToken({ refreshToken });
            if (refreshed?.accessToken) {
              setAuthToken(refreshed.accessToken);
              const profile = await authApi.getMe() as AuthProfile;
              setAuthData(refreshed.accessToken, applyProfile(profile), refreshToken);
              return;
            }
          } catch (refreshErr) {
            if (isNetworkError(refreshErr)) {
              const cached = readCachedUser();
              if (cached) {
                setUser(cached);
                setSession({ accessToken: token, user: cached });
              }
              return;
            }
          }
        }
        console.error('[useAuth] AuthError triggered, clearing auth data. Error details:', error);
        clearAuthData();
        // Removed hard window.location.href reload. 
        // clearAuthData() sets user to null, which gracefully triggers React Router's <Navigate to="/auth" /> in <ProtectedRoute>.
      } else if (isNetworkError(error)) {
        const cached = readCachedUser();
        if (cached) {
          setUser(cached);
          setSession({ accessToken: token, user: cached });
        }
      } else {
        console.error('[useAuth] Unknown error during auth load, clearing auth data. Error details:', error);
        clearAuthData();
      }
    } finally {
      setLoading(false);
    }
  }, [setAuthData, clearAuthData]);

  useEffect(() => {
    loadUserFromToken();
  }, [loadUserFromToken]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await authApi.login({ email, password });
      applyLoginPayload(response);
    } catch (error) {
      if (!isNetworkError(error)) clearAuthData();
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: { email: string; password: string; firstName?: string; lastName?: string }) => {
    setLoading(true);
    try {
      const response = await authApi.register(data);
      applyLoginPayload(response);
    } catch (error) {
      if (!isNetworkError(error)) clearAuthData();
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const completeOAuthLogin = async (token: string) => {
    setLoading(true);
    try {
      setAuthToken(token);
      const profile = await authApi.getMe() as AuthProfile;
      setAuthData(token, applyProfile(profile));
    } catch (error) {
      if (!isNetworkError(error)) clearAuthData();
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const requestPasswordReset = async (email: string) => {
    await authApi.requestPasswordReset(email);
  };

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    } finally {
      clearAuthData();
      // Rely on React Router <Navigate> to smoothly transition the user without a browser reload.
    }
  }, [clearAuthData]);

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      login,
      register,
      completeOAuthLogin,
      requestPasswordReset,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
