import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { workspacesApi } from '@/lib/api';
import { useTenant } from '@/hooks/useTenant';

const STORAGE_KEY = 'active_workspace';

type WorkspaceRow = { id: string; name: string };

type WorkspaceContextValue = {
  workspaces: WorkspaceRow[];
  activeWorkspace: string | null;
  defaultWorkspaceId: string | null;
  setActiveWorkspace: (id: string) => void;
  loading: boolean;
  refetch: () => Promise<void>;
  /** Bumps on every workspace switch so pages can refetch scoped data. */
  workspaceVersion: number;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [activeWorkspace, setActiveWorkspaceState] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [workspaceVersion, setWorkspaceVersion] = useState(0);

  const load = useCallback(async () => {
    if (!tenant) {
      setWorkspaces([]);
      setActiveWorkspaceState(null);
      return;
    }
    setLoading(true);
    try {
      const data = await workspacesApi.findAll(tenant.id);
      const list = (Array.isArray(data) ? data : []) as WorkspaceRow[];
      setWorkspaces(list);
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && list.some((w) => w.id === stored)) {
        setActiveWorkspaceState(stored);
      } else {
        setActiveWorkspaceState(list[0]?.id ?? null);
        if (list[0]?.id) localStorage.setItem(STORAGE_KEY, list[0].id);
      }
    } catch {
      setWorkspaces([]);
      setActiveWorkspaceState(null);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    void load();
  }, [load]);

  const setActiveWorkspace = useCallback(
    (id: string) => {
      if (id === activeWorkspace) return;
      setActiveWorkspaceState(id);
      localStorage.setItem(STORAGE_KEY, id);
      setWorkspaceVersion((v) => v + 1);
      void queryClient.invalidateQueries();
    },
    [activeWorkspace, queryClient],
  );

  const value = useMemo(
    () => ({
      workspaces,
      activeWorkspace,
      defaultWorkspaceId: activeWorkspace,
      setActiveWorkspace,
      loading,
      refetch: load,
      workspaceVersion,
    }),
    [workspaces, activeWorkspace, setActiveWorkspace, loading, load, workspaceVersion],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used within WorkspaceProvider');
  }
  return ctx;
}
