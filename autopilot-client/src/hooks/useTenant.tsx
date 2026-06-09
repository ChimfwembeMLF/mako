import React, {
  createContext, useContext, useEffect, useState, useCallback, ReactNode,
} from 'react';
import { tenantsApi, tenantMembersApi } from '@/lib/api';
import { isNetworkError } from '@/lib/api-errors';
import { useAuth } from '@/hooks/useAuth';
import { invalidatePermissionCache } from '@/hooks/usePermissions';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  owner_id: string;
  themeConfig?: Record<string, unknown>;
}

export interface TenantMember {
  tenant_id: string;
  user_id: string;
  role_id: string | null;
  is_active: boolean;
  role_name?: string;
}

interface TenantContextValue {
  tenant: Tenant | null;
  tenants: Tenant[];
  membership: TenantMember | null;
  isOwner: boolean;
  loading: boolean;
  switchTenant: (id: string) => void;
  refetch: () => void;
}

const TenantContext = createContext<TenantContextValue | null>(null);
const STORAGE_KEY = 'brandpilot_active_tenant';
const TENANT_CACHE_KEY = 'brandpilot_cached_tenant';

function cacheTenant(t: Tenant) {
  try {
    sessionStorage.setItem(TENANT_CACHE_KEY, JSON.stringify(t));
  } catch {
    /* ignore */
  }
}

function readCachedTenant(): Tenant | null {
  try {
    const raw = sessionStorage.getItem(TENANT_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Tenant) : null;
  } catch {
    return null;
  }
}

function mapTenant(raw: Record<string, unknown>): Tenant {
  return {
    id: String(raw.id),
    name: String(raw.name ?? ''),
    slug: String(raw.slug ?? ''),
    logo_url: (raw.logoUrl as string | null) ?? (raw.logo_url as string | null) ?? null,
    owner_id: String(raw.ownerId ?? raw.owner_id ?? ''),
    themeConfig: (raw.themeConfig as Record<string, unknown> | undefined) ?? undefined,
  };
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [membership, setMembership] = useState<TenantMember | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMembership = useCallback(async (active: Tenant, userId: string) => {
    try {
      const memberships = await tenantMembersApi.findMine();
      const mem = (Array.isArray(memberships) ? memberships : []).find(
        (m: Record<string, unknown>) => m.tenantId === active.id,
      );
      if (mem) {
        setMembership({
          tenant_id: String(mem.tenantId),
          user_id: String(mem.userId),
          role_id: mem.roleId ? String(mem.roleId) : null,
          is_active: Boolean(mem.isActive),
        });
      } else {
        setMembership(null);
      }
    } catch {
      setMembership(null);
    }
  }, []);

  const load = useCallback(async () => {
    if (!user) {
      setTenants([]);
      setTenant(null);
      setMembership(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rawTenants = await tenantsApi.findMine();
      const list = (Array.isArray(rawTenants) ? rawTenants : []).map((t) =>
        mapTenant(t as Record<string, unknown>),
      );
      setTenants(list);

      const storedId = localStorage.getItem(STORAGE_KEY);
      const active = list.find((t) => t.id === storedId) ?? list[0] ?? null;
      setTenant(active);
      if (active) cacheTenant(active);

      if (active) {
        await loadMembership(active, user.id);
      } else {
        setMembership(null);
      }
    } catch (err) {
      if (isNetworkError(err)) {
        const cached = readCachedTenant();
        if (cached) setTenant(cached);
      } else {
        setTenants([]);
        setTenant(null);
        setMembership(null);
      }
    } finally {
      setLoading(false);
    }
  }, [user, loadMembership]);

  useEffect(() => { load(); }, [load]);

  const switchTenant = (id: string) => {
    const t = tenants.find((t) => t.id === id);
    if (!t || !user) return;
    localStorage.setItem(STORAGE_KEY, id);
    cacheTenant(t);
    setTenant(t);
    invalidatePermissionCache();
    loadMembership(t, user.id);
  };

  const isOwner = tenant?.owner_id === user?.id;

  return (
    <TenantContext.Provider value={{ tenant, tenants, membership, isOwner, loading, switchTenant, refetch: load }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used inside <TenantProvider>');
  return ctx;
}
