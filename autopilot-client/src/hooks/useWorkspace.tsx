import { useState, useEffect, useCallback } from 'react';
import { workspacesApi } from '@/lib/api';
import { useTenant } from '@/hooks/useTenant';

export function useWorkspace() {
  const { tenant } = useTenant();
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!tenant) {
      setWorkspaces([]);
      setActiveWorkspace(null);
      return;
    }
    setLoading(true);
    try {
      const data = await workspacesApi.findAll(tenant.id);
      const list = Array.isArray(data) ? data : [];
      setWorkspaces(list);
      const stored = localStorage.getItem('active_workspace');
      if (stored && list.find((w: { id: string }) => w.id === stored)) {
        setActiveWorkspace(stored);
      } else if (list.length) {
        setActiveWorkspace(list[0].id);
      }
    } catch {
      setWorkspaces([]);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => { load(); }, [load]);

  const switchWorkspace = (id: string) => {
    setActiveWorkspace(id);
    localStorage.setItem('active_workspace', id);
  };

  return { workspaces, activeWorkspace, setActiveWorkspace: switchWorkspace, loading, refetch: load };
}
