import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tenantIntegrationConfigsApi } from '../../lib/api';

export interface TenantIntegrationConfig {
  id: string;
  tenantId: string;
  provider: 'MISTRAL' | 'OPENAI' | 'GEMINI' | string;
  isConfigured: boolean;
  updatedAt: string;
}

export function useTenantIntegrationConfigs(tenantId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['tenant-integration-configs', tenantId],
    queryFn: async () => {
      const data = await tenantIntegrationConfigsApi.getConfigs(tenantId);
      return data;
    },
    enabled: !!tenantId,
  });

  const upsertMutation = useMutation({
    mutationFn: async (params: { provider: string; apiKey: string }) => {
      const data = await tenantIntegrationConfigsApi.upsertConfig(tenantId, params);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['tenant-integration-configs', tenantId],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (provider: string) => {
      const data = await tenantIntegrationConfigsApi.deleteConfig(tenantId, provider);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['tenant-integration-configs', tenantId],
      });
    },
  });

  return {
    configs: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    upsertConfig: upsertMutation.mutateAsync,
    isUpserting: upsertMutation.isPending,
    deleteConfig: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
