import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  getActiveWorkspaceId,
  getTenantId,
  saveActiveWorkspaceId,
  saveTenantId,
} from '../lib/auth-store';
import { useAuth } from './AuthContext';

export type WorkspaceContextValue = {
  id: string;
  name: string;
  role: string;
  tenantId?: string;
};

interface WorkspaceContextType {
  activeWorkspace: WorkspaceContextValue | null;
  tenantId: string | null;
  isLoading: boolean;
  setActiveWorkspace: (workspace: WorkspaceContextValue | null) => Promise<void>;
  setTenantId: (tenantId: string | null) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [activeWorkspace, setActiveWorkspaceState] = useState<WorkspaceContextValue | null>(null);
  const [tenantId, setTenantIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!token) {
        if (!cancelled) {
          setActiveWorkspaceState(null);
          setTenantIdState(null);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      try {
        const [storedWorkspaceId, storedTenantId] = await Promise.all([
          getActiveWorkspaceId(),
          getTenantId(),
        ]);
        if (cancelled) return;

        setTenantIdState(storedTenantId);
        if (storedWorkspaceId) {
          setActiveWorkspaceState({
            id: storedWorkspaceId,
            name: 'Selected workspace',
            role: 'member',
            tenantId: storedTenantId ?? undefined,
          });
        } else {
          setActiveWorkspaceState(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const setActiveWorkspace = useCallback(async (workspace: WorkspaceContextValue | null) => {
    await saveActiveWorkspaceId(workspace?.id ?? null);
    if (workspace?.tenantId) {
      await saveTenantId(workspace.tenantId);
      setTenantIdState(workspace.tenantId);
    }
    setActiveWorkspaceState(workspace);
  }, []);

  const setTenantId = useCallback(async (nextTenantId: string | null) => {
    await saveTenantId(nextTenantId);
    setTenantIdState(nextTenantId);
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        activeWorkspace,
        tenantId,
        isLoading,
        setActiveWorkspace,
        setTenantId,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
