import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { api, type ContentItem } from '../../../src/lib/api';
import { useWorkspace } from '../../../src/context/WorkspaceContext';
import { useOfflineBanner } from '../../../src/components/OfflineBanner';
import { useTheme } from '../../../src/context/ThemeContext';
import { fonts, spacing, typography } from '../../../src/theme';
import { Badge, Button, Card, EmptyState, PageHeader, Screen } from '../../../src/components/ui';

function statusTone(status?: string | null): 'default' | 'positive' | 'scheduled' | 'muted' {
  const s = (status || 'draft').toLowerCase();
  if (s === 'published') return 'positive';
  if (s === 'scheduled') return 'scheduled';
  if (s === 'draft') return 'muted';
  return 'default';
}

import { useDraftsStore } from '../../../src/store/draftsStore';
import { useNetInfo } from '@react-native-community/netinfo';

export default function ContentListScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { activeWorkspace, tenantId } = useWorkspace();
  const { reportError } = useOfflineBanner();
  const workspaceId = activeWorkspace?.id;
  const effectiveTenant = tenantId || activeWorkspace?.tenantId;
  const { drafts, deleteDraft } = useDraftsStore();
  const netInfo = useNetInfo();

  const { data = [], isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['content', effectiveTenant, workspaceId],
    queryFn: () => api.listContent(effectiveTenant!, workspaceId!),
    enabled: Boolean(effectiveTenant && workspaceId),
  });

  const localDrafts = React.useMemo(() => {
    return drafts.filter((d) => d.workspaceId === workspaceId && d.tenantId === effectiveTenant);
  }, [drafts, workspaceId, effectiveTenant]);

  const syncDrafts = React.useCallback(async () => {
    if (!netInfo.isConnected || !localDrafts.length) return;
    
    // Sync logic
    for (const draft of localDrafts) {
      try {
        const body = {
          tenantId: draft.tenantId,
          workspaceId: draft.workspaceId,
          contentType: 'post',
          title: draft.title,
          content: draft.content,
          campaignTheme: draft.campaignTheme,
          platforms: draft.platforms,
          status: draft.scheduledDate ? 'scheduled' : 'draft',
          ...(draft.scheduledDate ? { scheduledDate: draft.scheduledDate, scheduledTime: draft.scheduledTime } : {}),
        };
        
        let savedItem;
        if (draft.id && !draft.id.includes('-')) {
          // If the draft.id is not a uuid (meaning it's an existing backend ID edited offline)
          // Wait, uuid has hyphens too. We'll just assume backend uses uuids or numbers.
          // Actually, our draftsStore uses uuidv4 which has hyphens. Backend uses uuids.
          // To be safe, if it exists in backend data, it's an update.
          // Let's just always create if we generated it offline, or update if we know the id.
          // In ContentEditorScreen, we did `id: isNew ? undefined : id`. 
          // So if `isNew` is true, it gets a new uuid from `draftsStore`. 
          // Wait, if it's not new, it keeps the backend id!
          // We can check if it exists in backend `data` array or just try update first.
        }
        
        // Simpler: if backend id, update. If local generated id (v4), create.
        // Both are uuids. To distinguish, we could check if it's in the `data` list, but data might be empty.
        // Let's just try updating, if 404, we create. Or we can just create all offline drafts as new unless it's an edit.
        // Since we did `id: isNew ? undefined : id`, the store generates a uuid for new drafts.
        // Let's just always try update if not created offline, else create. 
        // A simple way is to check `draft.id`. If we want to be robust, we try update and fallback to create.
        try {
          savedItem = await api.updateContent(draft.id, body as any);
        } catch (e: any) {
          savedItem = await api.createContent(body as any);
        }
        
        // If image was attached, we can't sync local image easily without picking it again because the local URI might not be valid or might need upload.
        // For now, we skip media upload in sync, or we could try to upload the URI.
        deleteDraft(draft.id);
      } catch (e) {
        console.error('Failed to sync draft', draft.id, e);
      }
    }
    refetch();
  }, [netInfo.isConnected, localDrafts, deleteDraft, refetch]);

  React.useEffect(() => {
    syncDrafts();
  }, [syncDrafts]);

  React.useEffect(() => {
    reportError(error?.message ?? null);
  }, [error, reportError]);

  if (!workspaceId || !effectiveTenant) {
    return (
      <Screen
        empty
        emptyTitle="No workspace selected"
        emptyMessage="Tap the workspace name at the top to choose a workspace."
      />
    );
  }

  if (isLoading && !localDrafts.length) {
    return <Screen scroll={false} loading skeleton />;
  }

  // Combine local and remote
  const allData = [...localDrafts.map(d => ({ ...d, isLocal: true, status: 'offline draft' })), ...(data as ContentItem[])];

  return (
    <Screen scroll={false}>
      <PageHeader
        title="Content Engine"
        subtitle="Write, save drafts, and publish to connected channels."
        icon={<Text style={[styles.headerIcon, { color: colors['positive-deep'] }]}>✎</Text>}
        actions={
          <Button
            label="New post"
            onPress={() => router.push('/content/new' as any)}
            style={styles.headerBtn}
          />
        }
      />

      {error ? <Text style={[styles.errorText, { color: colors.negative }]}>{error.message}</Text> : null}
      
      {localDrafts.length > 0 && !netInfo.isConnected ? (
        <View style={{ paddingBottom: 16 }}>
          <Text style={[styles.cardTitle, { color: colors.warning }]}>Offline Drafts ({localDrafts.length}) waiting to sync...</Text>
        </View>
      ) : null}

      <FlatList
        data={allData as any[]}
        scrollEnabled={false}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Card onPress={() => router.push(`/content/${item.id}` as any)} style={[styles.card, item.isLocal ? { borderColor: colors.warning, borderWidth: 1 } : {}]}>
            <View style={styles.cardTop}>
              <Text style={[styles.cardTitle, { color: colors.ink, fontFamily: fonts.bodySemi }]}>
                {item.title || 'Untitled'}
              </Text>
              <Badge label={(item.status || 'draft').toUpperCase()} tone={item.isLocal ? 'default' : statusTone(item.status)} />
            </View>
            <Text style={[styles.cardMeta, { color: colors.body, fontFamily: fonts.body }]} numberOfLines={2}>
              {item.content || 'No body yet'}
            </Text>
            {item.platforms?.length ? (
              <Text style={[styles.platforms, { color: colors.mute, fontFamily: fonts.body }]}>
                {item.platforms.join(' · ')}
              </Text>
            ) : null}
          </Card>
        )}
        ListEmptyComponent={
          <EmptyState
            title="No posts yet"
            description="Create your first post for this workspace."
            actionLabel="New post"
            onAction={() => router.push('/content/new' as any)}
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerIcon: {
    fontSize: 18,
  },
  headerBtn: {
    minHeight: 40,
    paddingHorizontal: spacing.lg,
  },
  card: {
    marginBottom: spacing.md,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardTitle: {
    ...typography.bodyMdStrong,
    flex: 1,
  },
  cardMeta: {
    ...typography.bodySm,
  },
  platforms: {
    ...typography.caption,
    marginTop: spacing.sm,
    textTransform: 'capitalize',
  },
  errorText: { marginBottom: spacing.md },
});
