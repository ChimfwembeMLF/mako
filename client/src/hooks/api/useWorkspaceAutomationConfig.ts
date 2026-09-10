import { useState, useEffect, useCallback } from 'react';
import { workspacesApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export interface WorkspaceAutomationConfig {
  id: string;
  workspaceId: string;
  isActive: boolean;
  timezone: string;
  generateAt: string;
  postsPerCycle: number;
  planAheadDays: number;
  publishingDays: string[];
  postingTimes: string[];
  platforms: string[];
  created_at: string;
  updated_at: string;
}

export function useWorkspaceAutomationConfig(workspaceId?: string | null) {
  const [config, setConfig] = useState<WorkspaceAutomationConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { session } = useAuth();

  const fetchConfig = useCallback(async () => {
    if (!workspaceId || !session?.access_token) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const data = await workspacesApi.getAutomationConfig(workspaceId);
      setConfig(data);
    } catch (err) {
      console.error('Failed to fetch automation config:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, session]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const updateConfig = async (payload: Partial<WorkspaceAutomationConfig>) => {
    if (!workspaceId) return null;
    
    setIsLoading(true);
    try {
      const data = await workspacesApi.updateAutomationConfig(workspaceId, payload as Record<string, unknown>);
      setConfig(data);
      return data;
    } catch (err) {
      console.error('Failed to update automation config:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    config,
    isLoading,
    error,
    updateConfig,
    refetch: fetchConfig,
  };
}
