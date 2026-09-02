import React from 'react';
import { FlatList, Share, StyleSheet, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../src/lib/api';
import { useWorkspace } from '../../../src/context/WorkspaceContext';
import { useTheme } from '../../../src/context/ThemeContext';
import { fonts, spacing, typography } from '../../../src/theme';
import { Card, EmptyState, PageHeader, Screen } from '../../../src/components/ui';

export default function MediaScreen() {
  const { colors } = useTheme();
  const { activeWorkspace, tenantId } = useWorkspace();
  const effectiveTenant = tenantId || activeWorkspace?.tenantId;
  const workspaceId = activeWorkspace?.id;

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['media', effectiveTenant, workspaceId],
    enabled: Boolean(effectiveTenant),
    queryFn: () => api.listMedia(effectiveTenant!, workspaceId),
  });

  if (!effectiveTenant) {
    return <Screen empty emptyTitle="No workspace" emptyMessage="Select a workspace from the header." />;
  }
  if (isLoading) return <Screen loading skeleton />;

  return (
    <Screen>
      <PageHeader
        title="Media"
        subtitle="Tap an asset to copy its URL."
        icon={<Text style={{ fontSize: 18, color: colors['positive-deep'] }}>🖼</Text>}
      />
      {error ? <Text style={{ color: colors.negative, marginBottom: spacing.md }}>{error.message}</Text> : null}
      <FlatList
        data={data as Array<{ id?: string; url?: string; name?: string; type?: string }>}
        scrollEnabled={false}
        keyExtractor={(item, i) => item.id || item.url || String(i)}
        renderItem={({ item }) => (
          <Card
            onPress={() => {
              if (item.url) {
                void Share.share({ message: item.url });
              }
            }}
            style={styles.card}
          >
            <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.bodySemi }]}>
              {item.name || item.type || 'Asset'}
            </Text>
            <Text style={[styles.url, { color: colors.mute, fontFamily: fonts.body }]} numberOfLines={1}>
              {item.url || '—'}
            </Text>
          </Card>
        )}
        ListEmptyComponent={
          <EmptyState title="No media yet" description="Upload assets from Content Engine or the web library." />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  title: { ...typography.bodyMdStrong },
  url: { ...typography.bodySm, marginTop: spacing.xxs },
});
