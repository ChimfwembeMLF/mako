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

export default function ContentListScreen() {
  const router = useRouter();
  const { colors } = useTheme();
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

  return (
    <Screen>
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

      <FlatList
        data={data as ContentItem[]}
        scrollEnabled={false}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Card onPress={() => router.push(`/content/${item.id}` as any)} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={[styles.cardTitle, { color: colors.ink, fontFamily: fonts.bodySemi }]}>
                {item.title || 'Untitled'}
              </Text>
              <Badge label={(item.status || 'draft').toUpperCase()} tone={statusTone(item.status)} />
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
