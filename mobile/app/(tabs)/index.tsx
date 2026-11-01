import React, { useCallback } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api, type ContentItem, type InboxConversation, type SocialAccount } from '../../src/lib/api';
import { postsDueToday, postsOverdue } from '../../src/lib/schedule';
import { TabShell } from '../../src/components/TabShell';
import { OnboardingHint } from '../../src/components/OnboardingHint';
import { useTheme } from '../../src/context/ThemeContext';
import { useWorkspace } from '../../src/context/WorkspaceContext';
import { useEffectivePermissions } from '../../src/hooks/useEffectivePermissions';
import { fonts, spacing, typography } from '../../src/theme';
import { Button, Card, Icon, PageHeader, QuickLinkCard, Screen, type IconName } from '../../src/components/ui';

type AttentionItem = {
  title: string;
  description: string;
  icon: IconName;
  route: string;
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

const isWaiting = (conversation: InboxConversation) => Number(conversation.unreadCount ?? 0) > 0;

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { activeWorkspace, tenantId } = useWorkspace();
  const perms = useEffectivePermissions();
  const effectiveTenant = tenantId || activeWorkspace?.tenantId;
  const workspaceId = activeWorkspace?.id;
  const hasWorkspace = Boolean(effectiveTenant && workspaceId);
  const canApprove = perms.can('approvals.view');

  const content = useQuery({
    queryKey: ['content', effectiveTenant, workspaceId],
    enabled: hasWorkspace,
    queryFn: () => api.listContent(effectiveTenant!, workspaceId!),
  });
  const accounts = useQuery({
    queryKey: ['social-accounts', effectiveTenant, workspaceId],
    enabled: hasWorkspace,
    queryFn: () => api.listSocialAccounts(effectiveTenant!, workspaceId),
  });
  const inbox = useQuery({
    queryKey: ['inbox', effectiveTenant, workspaceId, 'all'],
    enabled: hasWorkspace,
    queryFn: () => api.listInboxConversations(effectiveTenant!, workspaceId, 'all'),
  });
  const approvals = useQuery({
    queryKey: ['home-approvals', effectiveTenant],
    enabled: hasWorkspace && canApprove,
    queryFn: () => api.listApprovalRequests(effectiveTenant!, { status: 'pending' }),
  });
  const brand = useQuery({
    queryKey: ['home-brand', effectiveTenant, workspaceId],
    enabled: hasWorkspace,
    queryFn: () => api.getBrandProfileMine(effectiveTenant!, workspaceId),
  });

  const { refetch: refetchContent } = content;
  const { refetch: refetchAccounts } = accounts;
  const { refetch: refetchInbox } = inbox;
  const { refetch: refetchApprovals } = approvals;
  const { refetch: refetchBrand } = brand;
  useFocusEffect(
    useCallback(() => {
      if (!hasWorkspace) return;
      void refetchContent();
      void refetchAccounts();
      void refetchInbox();
      void refetchBrand();
      if (canApprove) void refetchApprovals();
    }, [hasWorkspace, canApprove, refetchContent, refetchAccounts, refetchInbox, refetchBrand, refetchApprovals]),
  );

  if (!hasWorkspace) {
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

  const posts = (content.data ?? []) as ContentItem[];
  const linkedAccounts = (accounts.data ?? []) as SocialAccount[];
  const waiting = ((inbox.data ?? []) as InboxConversation[]).filter(isWaiting).length;
  const pendingApprovals = Array.isArray(approvals.data) ? approvals.data.length : 0;
  const overdue = postsOverdue(posts).length;
  const today = postsDueToday(posts).sort((a, b) =>
    String(a.scheduledTime || '').localeCompare(String(b.scheduledTime || '')),
  );

  const hasPublished = posts.some((post) => (post.status || '').toLowerCase() === 'published');

  const attention: AttentionItem[] = [];
  // New workspaces get this from the setup checklist; this catches accounts lost later.
  if (accounts.isSuccess && linkedAccounts.length === 0 && hasPublished) {
    attention.push({
      title: 'Reconnect a social account',
      description: 'Nothing can be published until you do',
      icon: 'connections',
      route: '/connections',
    });
  }
  if (waiting > 0) {
    attention.push({
      title: plural(waiting, 'conversation'),
      description: 'Waiting for a reply',
      icon: 'inbox',
      route: '/inbox',
    });
  }
  if (pendingApprovals > 0) {
    attention.push({
      title: plural(pendingApprovals, 'approval'),
      description: 'Waiting for your review',
      icon: 'approvals',
      route: '/more/approvals',
    });
  }
  if (overdue > 0) {
    attention.push({
      title: plural(overdue, 'overdue post'),
      description: 'Scheduled but not published',
      icon: 'calendar',
      route: '/schedule',
    });
  }

  const loaded = content.isSuccess && accounts.isSuccess && !brand.isLoading;

  return (
    <TabShell>
      <Screen>
        <PageHeader
          title="Today"
          subtitle={new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        />

        <Button
          label="Create post"
          onPress={() => router.push('/content/new' as any)}
          style={styles.create}
        />

        {loaded ? (
          <OnboardingHint
            steps={[
              {
                label: 'Connect a social account',
                done: linkedAccounts.length > 0,
                onPress: () => router.push('/connections' as any),
              },
              {
                label: 'Set your brand voice',
                done: Boolean(brand.data?.id),
                onPress: () => router.push('/more/brand-brain' as any),
              },
              {
                label: 'Publish your first post',
                done: hasPublished,
                onPress: () => router.push('/content/new' as any),
              },
            ]}
          />
        ) : null}

        <Text style={[styles.section, { color: colors.mute }]}>Needs attention</Text>
        {attention.length > 0 ? (
          attention.map((item) => (
            <QuickLinkCard
              key={item.route}
              title={item.title}
              description={item.description}
              icon={<Icon name={item.icon} size={20} color={colors['positive-deep']} />}
              onPress={() => router.push(item.route as any)}
            />
          ))
        ) : (
          <Card style={styles.note}>
            <Text style={[styles.noteText, { color: colors.body }]}>
              {loaded ? "You're all caught up." : 'Checking your workspace…'}
            </Text>
          </Card>
        )}

        <Text style={[styles.section, { color: colors.mute }]}>Going out today</Text>
        {today.length > 0 ? (
          today.slice(0, 3).map((post) => (
            <QuickLinkCard
              key={post.id}
              title={post.title || 'Untitled'}
              description={[post.scheduledTime, post.platforms?.join(', ')].filter(Boolean).join(' · ') || 'Today'}
              icon={<Icon name="calendar" size={20} color={colors['positive-deep']} />}
              onPress={() => router.push(`/content/${post.id}` as any)}
            />
          ))
        ) : (
          <Card style={styles.note}>
            <Text style={[styles.noteText, { color: colors.body }]}>Nothing scheduled for today.</Text>
          </Card>
        )}
        <Button
          label="See full schedule"
          variant="ghost"
          onPress={() => router.push('/schedule' as any)}
        />
      </Screen>
    </TabShell>
  );
}

const styles = StyleSheet.create({
  create: {
    marginBottom: spacing.xl,
  },
  section: {
    ...typography.labelUppercase,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  note: {
    marginBottom: spacing.md,
  },
  noteText: {
    ...typography.bodySm,
    fontFamily: fonts.bodyMedium,
  },
});
