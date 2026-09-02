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
  /** Drop stored selection if it is not in the provided list. */
  reconcileWorkspaces: (workspaces: Array<{ id: string; name?: string; tenantId?: string; role?: string }>) => Promise<void>;
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

  const reconcileWorkspaces = useCallback(
    async (
      workspaces: Array<{ id: string; name?: string; tenantId?: string; role?: string }>,
    ) => {
      if (!workspaces.length) {
        if (activeWorkspace) await setActiveWorkspace(null);
        return;
      }

      if (activeWorkspace) {
        const match = workspaces.find((w) => w.id === activeWorkspace.id);
        if (!match) {
          await setActiveWorkspace(null);
          return;
        }
        if (match.name && match.name !== activeWorkspace.name) {
          await setActiveWorkspace({
            id: match.id,
            name: match.name,
            role: match.role || 'member',
            tenantId: match.tenantId || activeWorkspace.tenantId,
          });
        }
        return;
      }

      const first = workspaces[0];
      await setActiveWorkspace({
        id: first.id,
        name: first.name || 'Workspace',
        role: first.role || 'member',
        tenantId: first.tenantId,
      });
    },
    [activeWorkspace, setActiveWorkspace],
  );

  return (
    <WorkspaceContext.Provider
      value={{
        activeWorkspace,
        tenantId,
        isLoading,
        setActiveWorkspace,
        setTenantId,
        reconcileWorkspaces,
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
