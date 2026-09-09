import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../src/lib/api';
import { useWorkspace } from '../../../src/context/WorkspaceContext';
import { useTheme } from '../../../src/context/ThemeContext';
import { fonts, spacing, typography } from '../../../src/theme';
import { Badge, Card, EmptyState, PageHeader, Screen } from '../../../src/components/ui';

type Member = {
  id: string;
  userId?: string | null;
  roleId?: string | null;
  status?: 'active' | 'pending';
  isActive?: boolean;
  profile?: { fullName?: string | null; email?: string | null } | null;
};

export default function TeamScreen() {
  const { colors } = useTheme();
  const { activeWorkspace, tenantId } = useWorkspace();
  const effectiveTenant = tenantId || activeWorkspace?.tenantId;

  const { data: members = [], isLoading, error } = useQuery({
    queryKey: ['team-members', effectiveTenant],
    enabled: Boolean(effectiveTenant),
    queryFn: () => api.listTeamMembers(effectiveTenant!),
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['roles', effectiveTenant],
    enabled: Boolean(effectiveTenant),
    queryFn: () => api.listRoles(effectiveTenant!),
  });

  const roleNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const role of roles as Array<{ id: string; name?: string }>) {
      if (role.id) map.set(role.id, role.name || 'Role');
    }
    return map;
  }, [roles]);

  if (!effectiveTenant) {
    return <Screen scroll={false} empty emptyTitle="No workspace" emptyMessage="Select a workspace from the header." />;
  }
  if (isLoading) return <Screen scroll={false} loading skeleton />;

  return (
    <Screen scroll={false}>
      <PageHeader
        title="Team"
        subtitle="Members with access to this workspace."
        icon={<Text style={{ fontSize: 18, color: colors['positive-deep'] }}>👥</Text>}
      />
      {error ? <Text style={{ color: colors.negative, marginBottom: spacing.md }}>{error.message}</Text> : null}
      <FlatList
        data={members as Member[]}
        scrollEnabled={false}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const name = item.profile?.fullName || item.profile?.email || 'Member';
          const email = item.profile?.email;
          const pending = item.status === 'pending';
          const roleLabel = item.roleId ? roleNameById.get(item.roleId) || 'Member' : 'Member';

          return (
            <Card style={styles.card}>
              <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.bodySemi }]}>{name}</Text>
              {email ? (
                <Text style={[styles.meta, { color: colors.mute, fontFamily: fonts.body }]}>{email}</Text>
              ) : null}
              <Text style={[styles.meta, { color: colors.mute, fontFamily: fonts.body }]}>{roleLabel}</Text>
              <Badge
                label={pending ? 'Pending invite' : item.isActive === false ? 'Inactive' : 'Active'}
                tone={pending ? 'warning' : item.isActive === false ? 'muted' : 'positive'}
              />
            </Card>
          );
        }}
        ListEmptyComponent={
          <EmptyState title="No team members" description="Invite teammates from the web app." />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  title: { ...typography.bodyMdStrong },
  meta: { ...typography.bodySm, marginTop: spacing.xxs },
});
