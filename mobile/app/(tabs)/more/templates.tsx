import React from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../src/lib/api';
import { useWorkspace } from '../../../src/context/WorkspaceContext';
import { useTheme } from '../../../src/context/ThemeContext';
import { fonts, spacing, typography } from '../../../src/theme';
import { Card, EmptyState, PageHeader, Screen } from '../../../src/components/ui';

export default function TemplatesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { activeWorkspace, tenantId } = useWorkspace();
  const effectiveTenant = tenantId || activeWorkspace?.tenantId;
  const workspaceId = activeWorkspace?.id;

  const { data = [], isLoading } = useQuery({
    queryKey: ['templates', effectiveTenant, workspaceId],
    enabled: Boolean(effectiveTenant),
    queryFn: () => api.listTemplates(effectiveTenant!, workspaceId),
  });

  if (!effectiveTenant) {
    return <Screen empty emptyTitle="No workspace" emptyMessage="Select a workspace from the header." />;
  }
  if (isLoading) return <Screen loading skeleton />;

  return (
    <Screen>
      <PageHeader
        title="Post Templates"
        subtitle="Tap a template to start a new draft with its copy."
        icon={<Text style={{ fontSize: 18, color: colors['positive-deep'] }}>📋</Text>}
      />
      <FlatList
        data={data as Array<{ id: string; name?: string; title?: string; body?: string; content?: string }>}
        scrollEnabled={false}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Card
            style={styles.card}
            onPress={() =>
              router.push({
                pathname: '/content/new' as any,
                params: {
                  templateTitle: item.name || item.title || '',
                  templateBody: item.body || item.content || '',
                },
              })
            }
          >
            <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.bodySemi }]}>
              {item.name || item.title || 'Template'}
            </Text>
            <Text style={[styles.body, { color: colors.mute, fontFamily: fonts.body }]} numberOfLines={2}>
              {item.body || item.content || '—'}
            </Text>
          </Card>
        )}
        ListEmptyComponent={<EmptyState title="No templates" description="Create templates on web to reuse here." />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  title: { ...typography.bodyMdStrong },
  body: { ...typography.bodySm, marginTop: spacing.xxs },
});
