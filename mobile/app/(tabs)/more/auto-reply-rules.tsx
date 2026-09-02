import React from 'react';
import { FlatList, StyleSheet, Switch, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../src/lib/api';
import { useWorkspace } from '../../../src/context/WorkspaceContext';
import { useTheme } from '../../../src/context/ThemeContext';
import { useEffectivePermissions } from '../../../src/hooks/useEffectivePermissions';
import { fonts, spacing, typography } from '../../../src/theme';
import { Badge, Card, EmptyState, PageHeader, Screen, useToast } from '../../../src/components/ui';

type ReplyRule = {
  id: string;
  name?: string;
  platform?: string;
  triggerKeywords?: string[];
  trigger_keywords?: string[];
  triggerSentiment?: string;
  trigger_sentiment?: string;
  aiGenerate?: boolean;
  ai_generate?: boolean;
  isActive?: boolean;
  is_active?: boolean;
};

function ruleField<T>(row: ReplyRule, snake: keyof ReplyRule, camel: keyof ReplyRule): T | undefined {
  return (row[snake] ?? row[camel]) as T | undefined;
}

export default function AutoReplyRulesScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { canManageAutoReply } = useEffectivePermissions();
  const { activeWorkspace, tenantId } = useWorkspace();
  const effectiveTenant = tenantId || activeWorkspace?.tenantId;
  const workspaceId = activeWorkspace?.id;

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['auto-reply-rules', effectiveTenant, workspaceId],
    enabled: Boolean(effectiveTenant),
    queryFn: () => api.listAutoReplyRules(effectiveTenant!, workspaceId),
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.updateAutoReplyRule(id, { isActive }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['auto-reply-rules', effectiveTenant, workspaceId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!effectiveTenant) {
    return <Screen empty emptyTitle="No workspace" emptyMessage="Select a workspace from the header." />;
  }
  if (isLoading) return <Screen loading skeleton />;

  const rules = data as ReplyRule[];

  return (
    <Screen>
      <PageHeader
        title="Auto-reply rules"
        subtitle="Toggle automated replies per platform."
        icon={<Text style={{ fontSize: 18, color: colors['positive-deep'] }}>🤖</Text>}
      />
      {!canManageAutoReply ? (
        <Text style={[styles.readonly, { color: colors.mute, fontFamily: fonts.body }]}>
          View only — you need manage rules permission to toggle.
        </Text>
      ) : null}
      {error ? <Text style={{ color: colors.negative, marginBottom: spacing.md }}>{error.message}</Text> : null}
      <FlatList
        data={rules}
        scrollEnabled={false}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const keywords = ruleField<string[]>(item, 'trigger_keywords', 'triggerKeywords') ?? [];
          const sentiment = ruleField<string>(item, 'trigger_sentiment', 'triggerSentiment') || 'any';
          const aiGenerate = ruleField<boolean>(item, 'ai_generate', 'aiGenerate');
          const isActive = ruleField<boolean>(item, 'is_active', 'isActive') ?? false;

          return (
            <Card style={styles.card}>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.bodySemi }]}>
                    {item.name || 'Untitled rule'}
                  </Text>
                  <Text style={[styles.meta, { color: colors.mute, fontFamily: fonts.body }]}>
                    {item.platform || 'platform'} · sentiment: {sentiment}
                  </Text>
                  {keywords.length ? (
                    <Text style={[styles.meta, { color: colors.mute, fontFamily: fonts.body }]} numberOfLines={1}>
                      Keywords: {keywords.join(', ')}
                    </Text>
                  ) : null}
                  <View style={styles.badges}>
                    <Badge label={isActive ? 'Active' : 'Paused'} tone={isActive ? 'positive' : 'muted'} />
                    {aiGenerate ? (
                      <View style={styles.badgeGap}>
                        <Badge label="AI generate" tone="muted" />
                      </View>
                    ) : null}
                  </View>
                </View>
                <Switch
                  value={isActive}
                  disabled={!canManageAutoReply || toggle.isPending}
                  onValueChange={(next) => toggle.mutate({ id: item.id, isActive: next })}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.canvas}
                />
              </View>
            </Card>
          );
        }}
        ListEmptyComponent={
          <EmptyState title="No auto-reply rules" description="Create rules on web to automate inbox replies." />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  readonly: { ...typography.bodySm, marginBottom: spacing.md },
  card: { marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  title: { ...typography.bodyMdStrong },
  meta: { ...typography.bodySm, marginTop: spacing.xxs },
  badges: { flexDirection: 'row', marginTop: spacing.sm, flexWrap: 'wrap' },
  badgeGap: { marginLeft: spacing.xs },
});
