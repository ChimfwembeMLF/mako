import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { api, type InboxConversation } from '../../../src/lib/api';
import { InboxThreadPanel } from '../../../src/components/InboxThreadPanel';
import { useWorkspace } from '../../../src/context/WorkspaceContext';
import { useTheme } from '../../../src/context/ThemeContext';
import { useOfflineBanner } from '../../../src/components/OfflineBanner';
import { fonts, spacing, typography } from '../../../src/theme';
import { Badge, Button, Card, Chip, EmptyState, PageHeader, Screen } from '../../../src/components/ui';

type ChannelFilter = 'all' | 'post_comment' | 'dm';

type SelectedThread = {
  id: string;
  channel?: string;
  contentId?: string;
};

const TABLET_MIN_WIDTH = 768;

export default function InboxListScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_MIN_WIDTH;
  const { colors } = useTheme();
  const { activeWorkspace, tenantId } = useWorkspace();
  const { reportError } = useOfflineBanner();
  const effectiveTenant = tenantId || activeWorkspace?.tenantId;
  const workspaceId = activeWorkspace?.id;
  const [channel, setChannel] = useState<ChannelFilter>('all');
  const [selected, setSelected] = useState<SelectedThread | null>(null);

  const { data = [], isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['inbox', effectiveTenant, workspaceId, channel],
    enabled: Boolean(effectiveTenant && workspaceId),
    queryFn: () => api.listInboxConversations(effectiveTenant!, workspaceId, channel),
  });

  React.useEffect(() => {
    reportError(error?.message ?? null);
  }, [error, reportError]);

  const sync = async () => {
    if (!effectiveTenant) return;
    await api.syncInbox(effectiveTenant, workspaceId);
    try {
      await api.fetchCommentReplies(effectiveTenant, workspaceId);
    } catch {
      // comment fetch may fail if no publications; still refresh DMs
    }
    await refetch();
  };

  const rows = useMemo(() => data as InboxConversation[], [data]);

  const openThread = (item: InboxConversation) => {
    const thread: SelectedThread = {
      id: item.id,
      channel: item.channel || '',
      contentId: item.contentId || '',
    };
    if (isTablet) {
      setSelected(thread);
      return;
    }
    router.push({
      pathname: `/inbox/${item.id}` as any,
      params: {
        channel: item.channel || '',
        contentId: item.contentId || '',
      },
    });
  };

  if (!workspaceId || !effectiveTenant) {
    return (
      <Screen
        empty
        emptyTitle="No workspace selected"
        emptyMessage="Tap the workspace name at the top to choose a workspace."
      />
    );
  }

  if (isLoading) {
    return <Screen loading skeleton />;
  }

  const listHeader = (
    <>
      <PageHeader
        title="Social Inbox"
        subtitle="Comments, DMs and replies for your connected channels."
        icon={<Text style={{ fontSize: 18, color: colors['positive-deep'] }}>✉</Text>}
        actions={
          <Button label="Sync" variant="outline" onPress={() => void sync()} style={styles.syncBtn} />
        }
      />
      <View style={styles.filters}>
        {(
          [
            ['all', 'All inbox'],
            ['post_comment', 'Comments'],
            ['dm', 'Messages'],
          ] as const
        ).map(([id, label]) => (
          <Chip key={id} label={label} selected={channel === id} onPress={() => setChannel(id)} />
        ))}
      </View>
    </>
  );

  const listBody = (
    <FlatList
      data={rows}
      scrollEnabled={!isTablet}
      refreshing={isRefetching}
      onRefresh={() => void refetch()}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={isTablet ? undefined : listHeader}
      renderItem={({ item }) => {
        const isComment = item.channel === 'post_comment';
        const isSelected = selected?.id === item.id;
        return (
          <Card onPress={() => openThread(item)} selected={isTablet && isSelected} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={[styles.cardTitle, { color: colors.ink, fontFamily: fonts.bodySemi }]}>
                {item.title || item.preview || 'Conversation'}
              </Text>
              <Badge label={isComment ? 'Comment' : 'Message'} tone={isComment ? 'scheduled' : 'default'} />
            </View>
            <Text style={[styles.cardMeta, { color: colors.mute, fontFamily: fonts.body }]} numberOfLines={2}>
              {item.preview || '—'}
            </Text>
            <Text style={[styles.cardMeta, { color: colors.mute, fontFamily: fonts.body }]}>
              {(item.platform || item.channel || 'inbox').toString()}
            </Text>
          </Card>
        );
      }}
      ListEmptyComponent={
        <EmptyState
          title="No conversations yet"
          description="Sync inbox to pull comments and DMs from connected channels."
          actionLabel="Sync now"
          onAction={() => void sync()}
        />
      }
    />
  );

  if (isTablet) {
    return (
      <Screen padded={false}>
        <View style={styles.tabletWrap}>
          <View style={[styles.listPane, { borderRightColor: colors.border }]}>
            {listHeader}
            {listBody}
          </View>
          <View style={styles.detailPane}>
            {selected ? (
              <InboxThreadPanel
                id={selected.id}
                channel={selected.channel}
                contentId={selected.contentId}
              />
            ) : (
              <View style={styles.detailEmpty}>
                <EmptyState
                  title="Select a conversation"
                  description="Choose a thread from the list to read and reply."
                />
              </View>
            )}
          </View>
        </View>
      </Screen>
    );
  }

  return <Screen>{listBody}</Screen>;
}

const styles = StyleSheet.create({
  syncBtn: { minHeight: 40, paddingHorizontal: spacing.lg },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  card: { marginBottom: spacing.md },
  cardTop: {
    flexDirection: 'row',
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
    marginTop: spacing.xxs,
  },
  tabletWrap: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 480,
  },
  listPane: {
    width: '38%',
    borderRightWidth: 1,
    padding: spacing.lg,
  },
  detailPane: {
    flex: 1,
  },
  detailEmpty: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
});
