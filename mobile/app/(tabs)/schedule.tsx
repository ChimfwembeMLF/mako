import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { api, type ContentItem } from '../../src/lib/api';
import { useWorkspace } from '../../src/context/WorkspaceContext';
import { useOfflineBanner } from '../../src/components/OfflineBanner';
import { colors, spacing, rounded, typography } from '../../src/theme';

export default function ScheduleScreen() {
  const router = useRouter();
  const { activeWorkspace, tenantId } = useWorkspace();
  const { reportError } = useOfflineBanner();
  const effectiveTenant = tenantId || activeWorkspace?.tenantId;
  const workspaceId = activeWorkspace?.id;

  const { data = [], isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['content', effectiveTenant, workspaceId],
    enabled: Boolean(effectiveTenant && workspaceId),
    queryFn: () => api.listContent(effectiveTenant!, workspaceId!),
  });

  React.useEffect(() => {
    reportError(error?.message ?? null);
  }, [error, reportError]);

  const scheduled = useMemo(() => {
    return (data as ContentItem[])
      .filter((item) => {
        const status = (item.status || '').toLowerCase();
        return status === 'scheduled' || Boolean(item.scheduledDate);
      })
      .sort((a, b) => String(a.scheduledDate || '').localeCompare(String(b.scheduledDate || '')));
  }, [data]);

  if (!workspaceId || !effectiveTenant) {
    return (
      <View style={styles.center}>
        <Text style={styles.meta}>Select a workspace on Home first.</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Schedule</Text>
      <FlatList
        data={scheduled}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/content/${item.id}` as any)}
          >
            <Text style={styles.cardTitle}>{item.title || 'Untitled'}</Text>
            <Text style={styles.meta}>
              {item.scheduledDate || '—'}
              {item.scheduledTime ? ` ${item.scheduledTime}` : ''} ·{' '}
              {(item.status || 'scheduled').toUpperCase()}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.meta}>No scheduled posts.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors['canvas-soft'], padding: spacing.lg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { ...typography.displayXs, color: colors.ink, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.canvas,
    borderRadius: rounded.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTitle: { ...typography.bodyMdStrong, color: colors.ink },
  meta: { ...typography.bodySm, color: colors.mute, marginTop: spacing.xs },
});
