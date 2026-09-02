import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../src/lib/api';
import { useWorkspace } from '../../../src/context/WorkspaceContext';
import { useTheme } from '../../../src/context/ThemeContext';
import { fonts, spacing, typography } from '../../../src/theme';
import { Badge, Card, EmptyState, PageHeader, Screen } from '../../../src/components/ui';

type InboundEmail = {
  id: string;
  fromEmail?: string;
  from_email?: string;
  subject?: string | null;
  body?: string;
  status?: string;
  createdAt?: string;
  created_at?: string;
  hasDraft?: boolean;
  has_draft?: boolean;
};

function emailField<T>(row: InboundEmail, snake: keyof InboundEmail, camel: keyof InboundEmail): T | undefined {
  return (row[snake] ?? row[camel]) as T | undefined;
}

function statusTone(status?: string): 'positive' | 'warning' | 'muted' {
  switch (status) {
    case 'processed':
      return 'positive';
    case 'failed':
      return 'warning';
    case 'skipped':
      return 'muted';
    default:
      return 'muted';
  }
}

function statusLabel(status?: string): string {
  switch (status) {
    case 'processed':
      return 'Draft ready';
    case 'skipped':
      return 'Skipped';
    case 'failed':
      return 'Failed';
    default:
      return 'Received';
  }
}

export default function MailScreen() {
  const { colors } = useTheme();
  const { activeWorkspace, tenantId } = useWorkspace();
  const effectiveTenant = tenantId || activeWorkspace?.tenantId;
  const workspaceId = activeWorkspace?.id;

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['gmail-status'],
    queryFn: () => api.getGmailStatus(),
  });

  const { data: inbox = [], isLoading: inboxLoading, error } = useQuery({
    queryKey: ['mail-inbox', effectiveTenant, workspaceId],
    enabled: Boolean(effectiveTenant),
    queryFn: () => api.listMailInbox(effectiveTenant!, workspaceId),
  });

  if (!effectiveTenant) {
    return <Screen empty emptyTitle="No workspace" emptyMessage="Select a workspace from the header." />;
  }
  if (statusLoading || inboxLoading) return <Screen loading skeleton />;

  const emails = inbox as InboundEmail[];

  return (
    <Screen>
      <PageHeader
        title="Mail"
        subtitle="Gmail connection and inbound messages."
        icon={<Text style={{ fontSize: 18, color: colors['positive-deep'] }}>✉️</Text>}
      />

      <Card style={styles.statusCard}>
        <Text style={[styles.statusTitle, { color: colors.ink, fontFamily: fonts.bodySemi }]}>
          Gmail {status?.connected ? 'connected' : 'not connected'}
        </Text>
        {status?.connected && status.email ? (
          <Text style={[styles.meta, { color: colors.mute, fontFamily: fonts.body }]}>{status.email}</Text>
        ) : (
          <Text style={[styles.meta, { color: colors.mute, fontFamily: fonts.body }]}>
            Connect Gmail from the web app to sync inbox messages here.
          </Text>
        )}
        {status?.inboxAutoReply ? (
          <View style={styles.badge}>
            <Badge label="Inbox auto-reply on" tone="positive" />
          </View>
        ) : null}
      </Card>

      <Text style={[styles.section, { color: colors.ink, fontFamily: fonts.bodySemi }]}>Inbox</Text>
      {error ? <Text style={{ color: colors.negative, marginBottom: spacing.md }}>{error.message}</Text> : null}
      <FlatList
        data={emails}
        scrollEnabled={false}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const from = emailField<string>(item, 'from_email', 'fromEmail') || 'Unknown sender';
          const subject = item.subject || '(No subject)';
          const body = item.body || '';
          const statusValue = item.status;
          const hasDraft = emailField<boolean>(item, 'has_draft', 'hasDraft');

          return (
            <Card style={styles.card}>
              <View style={styles.row}>
                <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.bodySemi }]} numberOfLines={1}>
                  {subject}
                </Text>
                <Badge label={statusLabel(statusValue)} tone={statusTone(statusValue)} />
              </View>
              <Text style={[styles.meta, { color: colors.mute, fontFamily: fonts.body }]}>{from}</Text>
              {body ? (
                <Text style={[styles.excerpt, { color: colors.mute, fontFamily: fonts.body }]} numberOfLines={2}>
                  {body.trim()}
                </Text>
              ) : null}
              {hasDraft ? (
                <View style={styles.badge}>
                  <Badge label="Draft available" tone="positive" />
                </View>
              ) : null}
            </Card>
          );
        }}
        ListEmptyComponent={
          <EmptyState title="Inbox empty" description="Synced Gmail messages will show up here." />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusCard: { marginBottom: spacing.lg },
  statusTitle: { ...typography.bodyMdStrong },
  section: { ...typography.bodyMdStrong, marginBottom: spacing.md },
  card: { marginBottom: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  title: { ...typography.bodyMdStrong, flex: 1 },
  meta: { ...typography.bodySm, marginTop: spacing.xxs },
  excerpt: { ...typography.bodySm, marginTop: spacing.sm },
  badge: { marginTop: spacing.sm, alignSelf: 'flex-start' },
});
