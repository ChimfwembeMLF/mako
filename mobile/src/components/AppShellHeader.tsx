import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import { useWorkspace, type WorkspaceContextValue } from '../context/WorkspaceContext';
import { Badge } from './ui/Badge';
import { Icon } from './ui/Icon';
import { Sheet, SheetRow } from './ui/Sheet';
import { fonts, rounded, spacing, typography } from '../theme';

type WorkspaceRow = {
  id: string;
  name?: string;
  tenantId?: string;
  role?: string;
};

export function AppShellHeader() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { activeWorkspace, tenantId, setActiveWorkspace, setTenantId, reconcileWorkspaces } =
    useWorkspace();
  const [open, setOpen] = useState(false);

  const { data: workspaces = [], isSuccess } = useQuery({
    queryKey: ['workspaces', tenantId],
    queryFn: () => api.getWorkspaces(tenantId),
  });

  React.useEffect(() => {
    if (Array.isArray(workspaces)) {
      void reconcileWorkspaces(workspaces as WorkspaceRow[]);
    }
  }, [workspaces, reconcileWorkspaces]);

  const selectWorkspace = async (item: WorkspaceRow) => {
    if (item.tenantId) await setTenantId(item.tenantId);
    const next: WorkspaceContextValue = {
      id: item.id,
      name: item.name || 'Untitled Workspace',
      role: item.role || 'member',
      tenantId: item.tenantId,
    };
    await setActiveWorkspace(next);
    setOpen(false);
  };

  const list = workspaces as WorkspaceRow[];
  if (isSuccess && list.length === 1 && list[0].id === activeWorkspace?.id) {
    return <View style={{ height: insets.top + spacing.lg }} />;
  }

  return (
    <>
      <View
        style={[styles.bar, { paddingTop: insets.top + spacing.lg }]}
      >
        <Pressable
          onPress={() => setOpen(true)}
          style={[styles.trigger, { borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel={`Switch workspace, current: ${activeWorkspace?.name || 'none'}`}
        >
          <Icon name="workspace" size={18} color={colors['positive-deep']} />
          <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>
            {activeWorkspace?.name || 'Select workspace'}
          </Text>
          <Icon name="chevronDown" size={18} color={colors.mute} />
        </Pressable>
      </View>

      <Sheet visible={open} onClose={() => setOpen(false)} title="Switch workspace">
        {(workspaces as WorkspaceRow[]).length === 0 ? (
          <Text style={[styles.empty, { color: colors.mute, fontFamily: fonts.body }]}>
            No workspaces found.
          </Text>
        ) : (
          (workspaces as WorkspaceRow[]).map((item) => {
            const selected = activeWorkspace?.id === item.id;
            return (
              <SheetRow
                key={item.id}
                label={item.name || 'Untitled Workspace'}
                subtitle={item.role ? `Role: ${item.role}` : undefined}
                selected={selected}
                onPress={() => void selectWorkspace(item)}
                right={selected ? <Badge label="Active" tone="positive" /> : null}
              />
            );
          })
        )}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    borderRadius: rounded.full,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
  },
  name: {
    ...typography.bodySm,
    fontFamily: fonts.bodySemi,
    flex: 1,
  },
  empty: {
    ...typography.bodyMd,
    paddingVertical: spacing.xl,
    textAlign: 'center',
  },
});
