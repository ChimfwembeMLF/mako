import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../src/lib/api';
import { useAuth } from '../../../src/context/AuthContext';
import { useWorkspace } from '../../../src/context/WorkspaceContext';
import { useTheme } from '../../../src/context/ThemeContext';
import { useEffectivePermissions } from '../../../src/hooks/useEffectivePermissions';
import { fonts, spacing, typography } from '../../../src/theme';
import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  Input,
  PageHeader,
  Screen,
  useToast,
} from '../../../src/components/ui';

type ApprovalRequest = {
  id: string;
  action_key?: string;
  actionKey?: string;
  resource_type?: string;
  resourceType?: string;
  status: string;
  requester_notes?: string | null;
  requesterNotes?: string | null;
  reviewer_notes?: string | null;
  reviewerNotes?: string | null;
  created_at?: string;
  createdAt?: string;
  profiles?: { full_name?: string | null; fullName?: string | null; email?: string | null };
  maker_checker_config?: { label?: string };
  makerCheckerConfig?: { label?: string };
};

function field<T>(row: Record<string, unknown>, snake: string, camel: string): T | undefined {
  return (row[snake] ?? row[camel]) as T | undefined;
}

function formatWhen(value?: string): string {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function ApprovalsScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const { canReviewApprovals } = useEffectivePermissions();
  const { activeWorkspace, tenantId } = useWorkspace();
  const effectiveTenant = tenantId || activeWorkspace?.tenantId;

  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['approval-requests', effectiveTenant, tab],
    enabled: Boolean(effectiveTenant),
    queryFn: () =>
      tab === 'pending'
        ? api.listApprovalRequests(effectiveTenant!, { status: 'pending' })
        : api.listApprovalRequests(effectiveTenant!, { statuses: ['approved', 'rejected'] }),
  });

  const decide = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'rejected' }) =>
      api.updateApprovalRequest(id, {
        status,
        reviewerNotes: notes[id]?.trim() || null,
        reviewedAt: new Date().toISOString(),
        reviewedBy: session?.userId,
      }),
    onSuccess: (_, vars) => {
      toast.success(vars.status === 'approved' ? 'Request approved' : 'Request rejected');
      void queryClient.invalidateQueries({ queryKey: ['approval-requests', effectiveTenant] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!effectiveTenant) {
    return <Screen empty emptyTitle="No workspace" emptyMessage="Select a workspace from the header." />;
  }
  if (isLoading) return <Screen loading skeleton />;

  const requests = data as ApprovalRequest[];

  return (
    <Screen>
      <PageHeader
        title="Approvals"
        subtitle="Review maker-checker requests."
        icon={<Text style={{ fontSize: 18, color: colors['positive-deep'] }}>✓</Text>}
      />
      <View style={styles.tabs}>
        <Chip label={`Pending${tab === 'pending' && requests.length ? ` (${requests.length})` : ''}`} selected={tab === 'pending'} onPress={() => setTab('pending')} />
        <Chip label="History" selected={tab === 'history'} onPress={() => setTab('history')} />
      </View>
      {error ? <Text style={{ color: colors.negative, marginBottom: spacing.md }}>{error.message}</Text> : null}
      <FlatList
        data={requests}
        scrollEnabled={false}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const row = item as unknown as Record<string, unknown>;
          const actionKey = field<string>(row, 'action_key', 'actionKey') || 'action';
          const label =
            field<{ label?: string }>(row, 'maker_checker_config', 'makerCheckerConfig')?.label ||
            actionKey.replace(/\./g, ' ');
          const requester =
            item.profiles?.full_name ||
            item.profiles?.fullName ||
            item.profiles?.email ||
            'Team member';
          const requesterNotes = field<string | null>(row, 'requester_notes', 'requesterNotes');
          const reviewerNotes = field<string | null>(row, 'reviewer_notes', 'reviewerNotes');
          const createdAt = field<string>(row, 'created_at', 'createdAt');
          const pending = item.status === 'pending';

          return (
            <Card style={styles.card}>
              <View style={styles.row}>
                <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.bodySemi }]}>{label}</Text>
                <Badge
                  label={item.status}
                  tone={
                    item.status === 'approved'
                      ? 'positive'
                      : item.status === 'rejected'
                        ? 'warning'
                        : 'warning'
                  }
                />
              </View>
              <Text style={[styles.meta, { color: colors.mute, fontFamily: fonts.body }]}>From {requester}</Text>
              {createdAt ? (
                <Text style={[styles.meta, { color: colors.mute, fontFamily: fonts.body }]}>{formatWhen(createdAt)}</Text>
              ) : null}
              {requesterNotes ? (
                <Text style={[styles.notes, { color: colors.ink, fontFamily: fonts.body }]}>{requesterNotes}</Text>
              ) : null}
              {reviewerNotes && !pending ? (
                <Text style={[styles.notes, { color: colors.mute, fontFamily: fonts.body }]}>
                  Reviewer: {reviewerNotes}
                </Text>
              ) : null}
              {pending && canReviewApprovals ? (
                <>
                  <Input
                    placeholder="Reviewer notes (optional)"
                    value={notes[item.id] || ''}
                    onChangeText={(v) => setNotes((prev) => ({ ...prev, [item.id]: v }))}
                    style={styles.input}
                  />
                  <View style={styles.actions}>
                    <Button
                      label="Approve"
                      variant="primary"
                      loading={decide.isPending}
                      onPress={() => decide.mutate({ id: item.id, status: 'approved' })}
                      style={styles.actionBtn}
                    />
                    <Button
                      label="Reject"
                      variant="outline"
                      loading={decide.isPending}
                      onPress={() => decide.mutate({ id: item.id, status: 'rejected' })}
                      style={styles.actionBtn}
                    />
                  </View>
                </>
              ) : null}
            </Card>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            title={tab === 'pending' ? 'All caught up' : 'No history yet'}
            description={
              tab === 'pending'
                ? 'No pending approval requests.'
                : 'Approved and rejected requests will appear here.'
            }
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  card: { marginBottom: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  title: { ...typography.bodyMdStrong, flex: 1 },
  meta: { ...typography.bodySm, marginTop: spacing.xxs },
  notes: { ...typography.bodySm, marginTop: spacing.sm },
  input: { marginTop: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionBtn: { flex: 1 },
});
