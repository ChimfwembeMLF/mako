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
import { useRouter } from 'expo-router';
import { api, type ContentItem } from '../../../src/lib/api';
import { useWorkspace } from '../../../src/context/WorkspaceContext';
import { useOfflineBanner } from '../../../src/components/OfflineBanner';
import { colors, spacing, rounded, typography } from '../../../src/theme';

export default function ContentListScreen() {
  const router = useRouter();
  const { activeWorkspace, tenantId } = useWorkspace();
  const { reportError } = useOfflineBanner();
  const workspaceId = activeWorkspace?.id;
  const effectiveTenant = tenantId || activeWorkspace?.tenantId;

  const { data = [], isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['content', effectiveTenant, workspaceId],
    queryFn: () => api.listContent(effectiveTenant!, workspaceId!),
    enabled: Boolean(effectiveTenant && workspaceId),
  });

  React.useEffect(() => {
    reportError(error?.message ?? null);
  }, [error, reportError]);

  if (!workspaceId || !effectiveTenant) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Select a workspace on Home first.</Text>
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
      <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/content/new' as any)}>
        <Text style={styles.primaryBtnText}>New post</Text>
      </TouchableOpacity>
      {error ? <Text style={styles.errorText}>{error.message}</Text> : null}
      <FlatList
        data={data as ContentItem[]}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/content/${item.id}` as any)}
          >
            <Text style={styles.cardTitle}>{item.title || 'Untitled'}</Text>
            <Text style={styles.cardMeta} numberOfLines={2}>
              {item.content || '—'}
            </Text>
            <Text style={styles.cardMeta}>
              {(item.status || 'draft').toUpperCase()}
              {item.platforms?.length ? ` · ${item.platforms.join(', ')}` : ''}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No posts yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors['canvas-soft'], padding: spacing.lg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: rounded.xl,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  primaryBtnText: { ...typography.buttonMd, color: colors['on-primary'] },
  card: {
    backgroundColor: colors.canvas,
    borderRadius: rounded.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTitle: { ...typography.bodyMdStrong, color: colors.ink },
  cardMeta: { ...typography.bodySm, color: colors.mute, marginTop: spacing.xs },
  errorText: { color: colors.negative, marginBottom: spacing.md },
  emptyText: { ...typography.bodyMd, color: colors.mute, textAlign: 'center' },
});
