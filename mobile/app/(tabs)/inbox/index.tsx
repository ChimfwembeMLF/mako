import React from 'react';
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
import { api, type InboxConversation } from '../../../src/lib/api';
import { useWorkspace } from '../../../src/context/WorkspaceContext';
import { useOfflineBanner } from '../../../src/components/OfflineBanner';
import { colors, spacing, rounded, typography } from '../../../src/theme';

export default function InboxListScreen() {
  const router = useRouter();
  const { activeWorkspace, tenantId } = useWorkspace();
  const { reportError } = useOfflineBanner();
  const effectiveTenant = tenantId || activeWorkspace?.tenantId;
  const workspaceId = activeWorkspace?.id;

  const { data = [], isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['inbox', effectiveTenant, workspaceId],
    enabled: Boolean(effectiveTenant && workspaceId),
    queryFn: () => api.listInboxConversations(effectiveTenant!, workspaceId),
  });

  React.useEffect(() => {
    reportError(error?.message ?? null);
  }, [error, reportError]);

  const sync = async () => {
    if (!effectiveTenant) return;
    await api.syncInbox(effectiveTenant, workspaceId);
    await refetch();
  };

  if (!workspaceId || !effectiveTenant) {
    return (
      <View style={styles.center}>
        <Text style={styles.meta}>Select a workspace on Home first.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.syncBtn} onPress={() => void sync()}>
        <Text style={styles.syncText}>Sync inbox</Text>
      </TouchableOpacity>
      {isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <FlatList
          data={data as InboxConversation[]}
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/inbox/${item.id}` as any)}
            >
              <Text style={styles.cardTitle}>
                {item.title || item.preview || item.platform || 'Conversation'}
              </Text>
              <Text style={styles.meta}>
                {[item.platform, item.channel].filter(Boolean).join(' · ')}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.meta}>No conversations yet.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors['canvas-soft'], padding: spacing.lg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  syncBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: rounded.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  syncText: { ...typography.buttonMd, color: colors['on-primary'] },
  card: {
    backgroundColor: colors.canvas,
    borderRadius: rounded.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTitle: { ...typography.bodyMdStrong, color: colors.ink },
  meta: { ...typography.bodySm, color: colors.mute, marginTop: spacing.xs },
});
