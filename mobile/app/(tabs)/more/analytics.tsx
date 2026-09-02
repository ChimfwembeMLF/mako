import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../src/lib/api';
import { useWorkspace } from '../../../src/context/WorkspaceContext';
import { useTheme } from '../../../src/context/ThemeContext';
import { fonts, spacing, typography } from '../../../src/theme';
import { Card, EmptyState, PageHeader, Screen } from '../../../src/components/ui';

export default function AnalyticsScreen() {
  const { colors } = useTheme();
  const { activeWorkspace, tenantId } = useWorkspace();
  const effectiveTenant = tenantId || activeWorkspace?.tenantId;
  const workspaceId = activeWorkspace?.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics-dashboard', effectiveTenant, workspaceId],
    enabled: Boolean(effectiveTenant),
    queryFn: () => api.getPlatformDashboard(effectiveTenant!, workspaceId),
  });

  if (!effectiveTenant) {
    return <Screen empty emptyTitle="No workspace" emptyMessage="Select a workspace from the header." />;
  }
  if (isLoading) return <Screen loading skeleton />;

  const metrics = (data as any)?.metrics || (data as any)?.cards || data;

  return (
    <Screen>
      <PageHeader
        title="Analytics"
        subtitle="High-level performance snapshot."
        icon={<Text style={{ fontSize: 18, color: colors['positive-deep'] }}>📊</Text>}
      />
      {error ? <Text style={{ color: colors.negative }}>{error.message}</Text> : null}
      {metrics && typeof metrics === 'object' && !Array.isArray(metrics) ? (
        <View style={styles.grid}>
          {Object.entries(metrics as Record<string, unknown>).slice(0, 12).map(([key, value]) => (
            <Card key={key} style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.ink, fontFamily: fonts.displaySemi }]}>
                {String(value ?? '—')}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mute, fontFamily: fonts.body }]}>
                {key.replace(/_/g, ' ')}
              </Text>
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState title="No analytics yet" description="Connect channels and publish to see metrics." />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statCard: { width: '47%', alignItems: 'center', paddingVertical: spacing.lg },
  statValue: { ...typography.displaySm, fontSize: 24 },
  statLabel: { ...typography.caption, marginTop: spacing.xs, textAlign: 'center', textTransform: 'capitalize' },
});
