import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/lib/api';
import { colors, spacing, rounded, typography } from '../../src/theme';
import { useWorkspace, type WorkspaceContextValue } from '../../src/context/WorkspaceContext';

type WorkspaceRow = {
  id: string;
  name?: string;
  tenantId?: string;
  role?: string;
};

export default function HomeScreen() {
  const { activeWorkspace, tenantId, setActiveWorkspace, setTenantId } = useWorkspace();

  const { data: workspaces = [], isLoading, error } = useQuery({
    queryKey: ['workspaces', tenantId],
    queryFn: () => api.getWorkspaces(tenantId),
  });

  React.useEffect(() => {
    if (!activeWorkspace?.id || !Array.isArray(workspaces) || workspaces.length === 0) return;
    const match = (workspaces as WorkspaceRow[]).find((w) => w.id === activeWorkspace.id);
    if (!match) return;
    if (match.name && match.name !== activeWorkspace.name) {
      void setActiveWorkspace({
        id: match.id,
        name: match.name,
        role: match.role || activeWorkspace.role || 'member',
        tenantId: match.tenantId || activeWorkspace.tenantId,
      });
    }
  }, [workspaces, activeWorkspace, setActiveWorkspace]);

  const selectWorkspace = async (item: WorkspaceRow) => {
    if (item.tenantId) {
      await setTenantId(item.tenantId);
    }
    const next: WorkspaceContextValue = {
      id: item.id,
      name: item.name || 'Untitled Workspace',
      role: item.role || 'member',
      tenantId: item.tenantId,
    };
    await setActiveWorkspace(next);
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Workspaces</Text>
      {activeWorkspace ? (
        <Text style={styles.activeLabel}>
          Active: {activeWorkspace.name}
        </Text>
      ) : (
        <Text style={styles.activeLabel}>Select a workspace to continue</Text>
      )}
      {error ? (
        <Text style={styles.errorText}>{error.message || 'Failed to fetch workspaces'}</Text>
      ) : null}

      <FlatList
        data={workspaces as WorkspaceRow[]}
        keyExtractor={(item, index) => item.id || index.toString()}
        renderItem={({ item }) => {
          const selected = activeWorkspace?.id === item.id;
          return (
            <TouchableOpacity
              style={[styles.card, selected && styles.cardSelected]}
              onPress={() => void selectWorkspace(item)}
            >
              <Text style={styles.cardTitle}>{item.name || 'Untitled Workspace'}</Text>
              <Text style={styles.cardSubtitle}>
                {selected ? 'Active workspace' : 'Tap to select'}
                {item.role ? ` · ${item.role}` : ''}
              </Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={styles.emptyText}>No workspaces found.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors['canvas-soft'],
    padding: spacing.xl,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors['canvas-soft'],
  },
  title: {
    ...typography.displayXs,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  activeLabel: {
    ...typography.bodySm,
    color: colors.mute,
    marginBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.canvas,
    borderRadius: rounded.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: colors.primary,
  },
  cardTitle: {
    ...typography.bodyMdStrong,
    color: colors.ink,
  },
  cardSubtitle: {
    ...typography.bodySm,
    color: colors.mute,
    marginTop: spacing.xs,
  },
  errorText: {
    color: colors.negative,
    marginBottom: spacing.lg,
  },
  emptyText: {
    ...typography.bodyMd,
    color: colors.mute,
  },
});
