import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { api, type ContentItem } from '../../src/lib/api';
import { TabShell } from '../../src/components/TabShell';
import { useWorkspace } from '../../src/context/WorkspaceContext';
import { useOfflineBanner } from '../../src/components/OfflineBanner';
import { useEffectivePermissions } from '../../src/hooks/useEffectivePermissions';
import { ScheduleCalendar } from '../../src/components/ScheduleCalendar';
import { toDateKey } from '../../src/lib/dates';
import { colors, fonts, spacing, typography } from '../../src/theme';
import { Badge, Button, Card, Chip, EmptyState, PageHeader, Screen, useToast } from '../../src/components/ui';

type ViewMode = 'calendar' | 'list';

function countDueToday(posts: ContentItem[]): number {
  const today = toDateKey(new Date());
  return posts.filter((p) => String(p.scheduledDate || '').slice(0, 10) === today).length;
}

function countOverdue(posts: ContentItem[]): number {
  const today = toDateKey(new Date());
  return posts.filter((p) => {
    const d = String(p.scheduledDate || '').slice(0, 10);
    return d && d < today;
  }).length;
}

export default function ScheduleScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeWorkspace, tenantId } = useWorkspace();
  const { reportError } = useOfflineBanner();
  const { canEdit } = useEffectivePermissions();
  const toast = useToast();
  const effectiveTenant = tenantId || activeWorkspace?.tenantId;
  const workspaceId = activeWorkspace?.id;
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('calendar');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data = [], isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['content', effectiveTenant, workspaceId],
    enabled: Boolean(effectiveTenant && workspaceId),
    queryFn: () => api.listContent(effectiveTenant!, workspaceId!),
  });

  React.useEffect(() => {
    reportError(error?.message ?? null);
  }, [error, reportError]);

  const scheduled = useMemo(() => {
    return (data as ContentItem[])
      .filter((item) => {
        const status = (item.status || '').toLowerCase();
        return status === 'scheduled' || Boolean(item.scheduledDate);
      })
      .sort((a, b) => String(a.scheduledDate || '').localeCompare(String(b.scheduledDate || '')));
  }, [data]);

  const visible = useMemo(() => {
    if (!selectedDate) return scheduled;
    return scheduled.filter(
      (item) => String(item.scheduledDate || '').slice(0, 10) === selectedDate,
    );
  }, [scheduled, selectedDate]);

  const cancelSchedule = async (item: ContentItem) => {
    if (!canEdit) {
      toast.error('You do not have permission to change scheduled posts.');
      return;
    }
    setCancellingId(item.id);
    try {
      await api.updateContent(item.id, {
        status: 'draft',
        scheduledDate: null,
        scheduledTime: null,
      });
      await queryClient.invalidateQueries({
        queryKey: ['content', effectiveTenant, workspaceId],
      });
      toast.success('Schedule cancelled');
    } catch (e: any) {
      toast.error(e.message || 'Could not cancel schedule');
    } finally {
      setCancellingId(null);
    }
  };

  if (!workspaceId || !effectiveTenant) {
    return (
      <TabShell>
        <Screen
          empty
          emptyTitle="No workspace selected"
          emptyMessage="Tap the workspace name at the top to choose a workspace."
        />
      </TabShell>
    );
  }

  if (isLoading) {
    return (
      <TabShell>
        <Screen scroll={false} loading skeleton />
      </TabShell>
    );
  }

  return (
    <TabShell>
    <Screen scroll={false}>
      <PageHeader
        title="Scheduler"
        subtitle="Calendar queue and upcoming posts for this workspace."
        icon={<Text style={styles.headerIcon}>▦</Text>}
        actions={
          <Button
            label="New post"
            onPress={() => router.push('/content/new' as any)}
            style={styles.headerBtn}
          />
        }
      />

      <View style={styles.viewToggle}>
        <Chip label="Calendar" selected={view === 'calendar'} onPress={() => setView('calendar')} />
        <Chip label="List" selected={view === 'list'} onPress={() => setView('list')} />
      </View>

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{scheduled.length}</Text>
          <Text style={styles.statLabel}>Scheduled</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, styles.statAmber]}>{countDueToday(scheduled)}</Text>
          <Text style={styles.statLabel}>Due today</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, styles.statDanger]}>{countOverdue(scheduled)}</Text>
          <Text style={styles.statLabel}>Overdue</Text>
        </Card>
      </View>

      {view === 'calendar' ? (
        <ScheduleCalendar
          month={calendarMonth}
          onMonthChange={setCalendarMonth}
          posts={scheduled}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onPostPress={(post) => router.push(`/content/${post.id}` as any)}
        />
      ) : null}

      {selectedDate ? (
        <Text style={styles.filterLabel}>
          Showing posts for {selectedDate}
          {' · '}
          <Text style={styles.clearFilter} onPress={() => setSelectedDate(null)}>
            Clear
          </Text>
        </Text>
      ) : null}

      <FlatList
        data={view === 'calendar' ? visible : scheduled}
        scrollEnabled={false}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Pressable style={styles.cardBody} onPress={() => router.push(`/content/${item.id}` as any)}>
              <Text style={styles.cardTitle}>{item.title || 'Untitled'}</Text>
              <View style={styles.metaRow}>
                <Badge label="SCHEDULED" tone="scheduled" />
                <Text style={styles.meta}>
                  {item.scheduledDate || '—'}
                  {item.scheduledTime ? ` · ${item.scheduledTime}` : ''}
                </Text>
              </View>
              {item.platforms?.length ? (
                <Text style={styles.platforms}>{item.platforms.join(' · ')}</Text>
              ) : null}
            </Pressable>
            {canEdit ? (
              cancellingId === item.id ? (
                <ActivityIndicator color={colors.negative} />
              ) : (
                <Button
                  label="Cancel"
                  variant="ghost"
                  onPress={() => void cancelSchedule(item)}
                  style={styles.cancelBtn}
                />
              )
            ) : null}
          </Card>
        )}
        ListEmptyComponent={
          <EmptyState
            title={selectedDate ? 'No posts on this date' : 'No scheduled posts'}
            description={
              selectedDate
                ? 'Pick another day or clear the date filter.'
                : 'Schedule a post from Content Engine.'
            }
            actionLabel={selectedDate ? undefined : 'New post'}
            onAction={selectedDate ? undefined : () => router.push('/content/new' as any)}
          />
        }
      />
    </Screen>
    </TabShell>
  );
}

const styles = StyleSheet.create({
  headerIcon: { fontSize: 18, color: colors['positive-deep'] },
  headerBtn: { minHeight: 40, paddingHorizontal: spacing.lg },
  viewToggle: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  statValue: {
    ...typography.displaySm,
    fontFamily: fonts.display,
    color: colors.ink,
    fontSize: 28,
    lineHeight: 32,
  },
  statAmber: { color: colors['warning-deep'] },
  statDanger: { color: colors.negative },
  statLabel: {
    ...typography.caption,
    fontFamily: fonts.body,
    color: colors.mute,
    marginTop: spacing.xxs,
    textAlign: 'center',
  },
  filterLabel: {
    ...typography.bodySm,
    fontFamily: fonts.body,
    color: colors.body,
    marginBottom: spacing.md,
  },
  clearFilter: {
    color: colors['positive-deep'],
    fontFamily: fonts.bodySemi,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  cardBody: { flex: 1 },
  cardTitle: {
    ...typography.bodyMdStrong,
    fontFamily: fonts.bodySemi,
    color: colors.ink,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  meta: {
    ...typography.bodySm,
    fontFamily: fonts.body,
    color: colors.mute,
  },
  platforms: {
    ...typography.caption,
    fontFamily: fonts.body,
    color: colors.mute,
    marginTop: spacing.sm,
    textTransform: 'capitalize',
  },
  cancelBtn: { minHeight: 36, paddingHorizontal: spacing.sm },
  emptyText: { ...typography.bodyMd, fontFamily: fonts.body, color: colors.mute, textAlign: 'center' },
});
