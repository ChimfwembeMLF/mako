import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../src/lib/api';
import { useWorkspace } from '../../../src/context/WorkspaceContext';
import { useTheme } from '../../../src/context/ThemeContext';
import { fonts, spacing, typography } from '../../../src/theme';
import { Badge, Card, EmptyState, PageHeader, Screen, Sheet } from '../../../src/components/ui';

type Lead = {
  id: string;
  name?: string;
  email?: string;
  source?: string;
  message?: string | null;
  classification?: string;
  status?: string;
  ai_reply?: string | null;
  aiReply?: string | null;
  created_at?: string;
  createdAt?: string;
};

function leadField<T>(lead: Lead, snake: keyof Lead, camel: keyof Lead): T | undefined {
  return (lead[snake] ?? lead[camel]) as T | undefined;
}

const classTone = (value?: string): 'warning' | 'muted' | 'positive' => {
  if (value === 'hot') return 'warning';
  if (value === 'warm') return 'positive';
  return 'muted';
};

export default function LeadsScreen() {
  const { colors } = useTheme();
  const { activeWorkspace, tenantId } = useWorkspace();
  const effectiveTenant = tenantId || activeWorkspace?.tenantId;
  const workspaceId = activeWorkspace?.id;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['leads', effectiveTenant, workspaceId],
    enabled: Boolean(effectiveTenant),
    queryFn: () => api.listLeads(effectiveTenant!, workspaceId),
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['lead', selectedId],
    enabled: Boolean(selectedId),
    queryFn: () => api.getLead(selectedId!),
  });

  if (!effectiveTenant) {
    return <Screen empty emptyTitle="No workspace" emptyMessage="Select a workspace from the header." />;
  }
  if (isLoading) return <Screen loading skeleton />;

  const leads = data as Lead[];
  const selected = (detail || leads.find((l) => l.id === selectedId)) as Lead | undefined;

  return (
    <Screen>
      <PageHeader
        title="Leads"
        subtitle="Inbound leads captured by your agent."
        icon={<Text style={{ fontSize: 18, color: colors['positive-deep'] }}>🎯</Text>}
      />
      {error ? <Text style={{ color: colors.negative, marginBottom: spacing.md }}>{error.message}</Text> : null}
      <FlatList
        data={leads}
        scrollEnabled={false}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Card style={styles.card} onPress={() => setSelectedId(item.id)}>
            <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.bodySemi }]}>
              {item.name || item.email || 'Lead'}
            </Text>
            {item.email ? (
              <Text style={[styles.meta, { color: colors.mute, fontFamily: fonts.body }]}>{item.email}</Text>
            ) : null}
            <Text style={[styles.meta, { color: colors.mute, fontFamily: fonts.body }]}>
              {item.source || 'Unknown source'} · {item.status || 'new'}
            </Text>
            {item.classification ? (
              <View style={styles.badge}>
                <Badge label={item.classification} tone={classTone(item.classification)} />
              </View>
            ) : null}
          </Card>
        )}
        ListEmptyComponent={<EmptyState title="No leads yet" description="Leads from webhooks and forms appear here." />}
      />

      <Sheet visible={Boolean(selectedId)} onClose={() => setSelectedId(null)} title={selected?.name || 'Lead detail'}>
        {detailLoading ? (
          <Text style={{ color: colors.mute, fontFamily: fonts.body }}>Loading…</Text>
        ) : selected ? (
          <>
            {selected.email ? (
              <Text style={[styles.detailLine, { color: colors.ink, fontFamily: fonts.body }]}>{selected.email}</Text>
            ) : null}
            <Text style={[styles.detailLine, { color: colors.mute, fontFamily: fonts.body }]}>
              Source: {selected.source || '—'} · Status: {selected.status || 'new'}
            </Text>
            {selected.classification ? (
              <View style={styles.badge}>
                <Badge label={selected.classification} tone={classTone(selected.classification)} />
              </View>
            ) : null}
            {selected.message ? (
              <Text style={[styles.message, { color: colors.ink, fontFamily: fonts.body }]}>{selected.message}</Text>
            ) : null}
            {leadField<string | null>(selected, 'ai_reply', 'aiReply') ? (
              <Text style={[styles.message, { color: colors.mute, fontFamily: fonts.body }]}>
                AI draft: {leadField<string | null>(selected, 'ai_reply', 'aiReply')}
              </Text>
            ) : null}
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  title: { ...typography.bodyMdStrong },
  meta: { ...typography.bodySm, marginTop: spacing.xxs },
  badge: { marginTop: spacing.sm, alignSelf: 'flex-start' },
  detailLine: { ...typography.bodySm, marginBottom: spacing.xs },
  message: { ...typography.bodyMd, marginTop: spacing.md },
});
